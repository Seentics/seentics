import { and, eq, isNotNull, isNull, lt, sql as raw } from "drizzle-orm";
import { db, ingestBatches, sql } from "../../../db";
import type { IngestLane, QueuedBatch } from "../interfaces";

/**
 * The durable queue, in Postgres.
 *
 * One naming seam to know about: the table's column is `category` and the code calls it
 * `lane`. The column is older than the rename and holds the same six values; renaming it
 * would mean a migration that has to land in lockstep with a deploy, on the one table that
 * is holding undelivered work while it happens. Not worth it for a word.
 *
 * Modelled on `platform/outbox/outbox-repository.ts` — same claim-and-park shape,
 * whose failure modes the team has already reasoned about — with one difference that
 * matters: a claim here is a written lease, not a row lock. See `claimPendingBatches`.
 */

/**
 * How long a claim is honoured before another worker may take the batch.
 *
 * Sized for the slowest sink rather than the average one: a heatmap batch can spend a
 * while in S3 puts, and re-claiming a batch that is still being applied is only safe
 * because the apply's own transaction completes the row — for recordings it would also break the
 * per-session chunk ordering the partition key exists to protect. Long enough that only a
 * genuinely dead worker hits it; short enough that its batches are not stranded for the
 * rest of the day.
 */
export const CLAIM_LEASE_MS = 5 * 60_000;

/**
 * Lanes whose batches must apply in order within a partition key, even across a retry.
 * Recordings assign chunk sequences per session at apply time; every other lane is
 * commutative within its key. See the backoff note on `claimPendingBatches`.
 */
const ORDERED_LANES: ReadonlySet<IngestLane> = new Set<IngestLane>(["recordings"]);

/** Postgres `unique_violation`. See the claim query. */
const UNIQUE_VIOLATION = "23505";

/**
 * Add a batch to the queue.
 *
 * `ON CONFLICT DO NOTHING` on the content-derived id makes enqueue itself idempotent, so
 * a flush that fails *after* writing the row and retries does not queue the batch twice.
 */
export async function enqueueBatch(batch: {
  batchId: string;
  lane: IngestLane;
  partitionKey: string;
  /** Already serialized by the producer — see `BatchQueue.enqueue`. */
  payloadJson: string;
  rowCount: number;
}): Promise<void> {
  // Raw rather than `db.insert(...).values(...)`: the payload arrives as text and is cast
  // straight to jsonb, so the driver never re-serializes a batch the producer has already
  // serialized once to derive its id.
  await sql`
    INSERT INTO ingest_batches (batch_id, category, partition_key, payload, row_count)
    VALUES (${batch.batchId}, ${batch.lane}, ${batch.partitionKey}, ${batch.payloadJson}::jsonb, ${batch.rowCount})
    ON CONFLICT (batch_id) DO NOTHING
  `
}

/**
 * Claim pending batches of one category, oldest first, by writing a lease.
 *
 * **The claim is `claimed_at`, not a lock.** It has to be. This runs through `db.execute`,
 * which is a single autocommit statement, so any `FOR UPDATE` it takes is released the
 * instant the statement returns — before the caller has applied anything. The previous
 * version relied on exactly that lock to mean "claimed", and so claimed nothing: two
 * workers would take the same row, and two batches for one partition key would be applied
 * concurrently. The completion marker hid the first problem for
 * analytics, funnels, automations and heatmaps. Recordings had no such cover — chunk
 * sequences are assigned per session, and two concurrent batches for one session overwrite
 * each other's chunks in object storage.
 *
 * So the whole thing is one atomic `UPDATE … RETURNING`. A row that comes back has its
 * lease written and committed; nothing else can select it until the lease expires.
 *
 * Three parts, in order:
 *
 * - `leased` is the set of partition keys with a batch currently in flight. Excluding them
 *   is what keeps ordering within a key: the next batch for a session waits for the
 *   current one rather than running beside it.
 * - `candidates` takes the oldest pending batch per remaining key. `DISTINCT ON` cannot
 *   carry `FOR UPDATE` — Postgres rejects the combination, and an earlier version that
 *   asked for both threw on every poll — which is the other reason the lock could not have
 *   been the claim here even in a transaction.
 * - `oldest` reapplies age ordering and bounds the poll. The `LIMIT` belongs here and not
 *   in `candidates`: `DISTINCT ON` must sort by its own key, so limiting inside it would
 *   take the twenty alphabetically-lowest partition keys every single poll and starve
 *   every key above them for as long as those twenty kept producing.
 * - the `UPDATE` re-checks the lease on the row it is about to take. Under READ COMMITTED a
 *   worker that blocks on a row another has just claimed re-evaluates this predicate
 *   against the new version, finds the lease set, and returns nothing for it. `SKIP LOCKED`
 *   means it does not wait to find that out.
 *
 * **Backoff.** A failed batch carries `next_attempt_at`, and is not claimable before it. How
 * a backing-off batch affects its siblings depends on the lane:
 *
 * - commutative lanes (everything keyed on a website) let it step aside — it is filtered out
 *   *before* `DISTINCT ON`, so the next batch for the site is applied meanwhile. Otherwise one
 *   bad batch would hold back a whole site's analytics for the retry window, which is hours.
 * - recordings keep it at the head of its session — filtered *after* `DISTINCT ON`, so the
 *   session waits rather than having its chunk sequence assigned out of order. One session
 *   stalls; once the batch parks, the session moves on as it always has.
 *
 * `ix_ingest_batches_pending` is what keeps `candidates` affordable without a `LIMIT`: it
 * is ordered `(category, partition_key, created_at)` and partial on `completed_at IS NULL`,
 * so `DISTINCT ON` reads it in the order it already wants and needs no sort. It still walks
 * the whole backlog for the category — on 40k pending batches that measured 10ms against
 * the old index's 26ms and 3.7MB sort — so a backlog that never drains is still a backlog,
 * and `countParked` is the thing to alert on.
 */
export async function claimPendingBatches(
  lane: IngestLane,
  limit: number,
  maxAttempts: number,
): Promise<QueuedBatch[]> {
  const leaseMs = CLAIM_LEASE_MS;
  const strictOrder = ORDERED_LANES.has(lane);
  try {
    const rows = await db.execute<{
      batch_id: string;
      category: string;
      partition_key: string;
      payload: { rows: unknown[] };
      row_count: number;
      attempts: number;
    }>(raw`
      WITH leased AS (
        SELECT partition_key
        FROM ingest_batches
        WHERE category = ${lane}
          AND completed_at IS NULL
          AND claimed_at IS NOT NULL
          AND claimed_at > now() - ${leaseMs} * interval '1 millisecond'
      ),
      candidates AS (
        SELECT DISTINCT ON (b.partition_key) b.batch_id, b.created_at, b.next_attempt_at
        FROM ingest_batches b
        WHERE b.category = ${lane}
          AND b.completed_at IS NULL
          AND b.attempts < ${maxAttempts}
          AND (${strictOrder}::boolean OR b.next_attempt_at IS NULL OR b.next_attempt_at <= now())
          AND NOT EXISTS (SELECT 1 FROM leased l WHERE l.partition_key = b.partition_key)
        ORDER BY b.partition_key, b.created_at ASC
      ),
      oldest AS (
        SELECT batch_id FROM candidates
        WHERE next_attempt_at IS NULL OR next_attempt_at <= now()
        ORDER BY created_at ASC LIMIT ${limit}
      ),
      locked AS (
        SELECT batch_id
        FROM ingest_batches
        WHERE batch_id IN (SELECT batch_id FROM oldest)
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ingest_batches t
      SET claimed_at = now()
      FROM locked l
      WHERE t.batch_id = l.batch_id
        AND t.completed_at IS NULL
        AND (t.claimed_at IS NULL OR t.claimed_at <= now() - ${leaseMs} * interval '1 millisecond')
      RETURNING t.batch_id, t.category, t.partition_key, t.payload, t.row_count, t.attempts
    `);

    return [...rows].map((r) => ({
      batchId: r.batch_id,
      lane: r.category as IngestLane,
      partitionKey: r.partition_key,
      payload: r.payload as { rows: unknown[] },
      rowCount: r.row_count,
      attempts: r.attempts,
    }));
  } catch (err) {
    // `ux_ingest_batches_one_inflight` firing means another worker claimed a sibling batch
    // of the same partition between this statement's snapshot and its write. That is the
    // constraint doing its job, not an outage: claim nothing and let the next tick pick up
    // whatever is still free. Reporting it as a failure would trip the worker's backoff.
    if (isUniqueViolation(err)) return [];
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/**
 * Record a failed attempt, release the lease, and hold the batch back for `retryAfterMs`.
 *
 * The row stays pending. Clearing `claimed_at` means the retry does not wait out the lease;
 * `next_attempt_at` means it does not happen on the very next tick either — retrying at the
 * poll interval burned every attempt inside a second, which is shorter than a database
 * failover. The not-before time is computed from the database clock, the same clock the
 * claim query compares it against.
 *
 * Once `attempts` reaches the cap the claim query stops returning it and the batch is
 * parked: visible to `countParked`, requeued by `requeueParkedBatches` after a cool-off,
 * and never silently dropped the way the in-memory flush drops a batch after three tries.
 * A parked batch holds no lease, so it cannot block its partition key.
 */
export async function markBatchFailed(batchId: string, error: string, retryAfterMs: number): Promise<void> {
  const delayMs = Math.max(0, Math.round(retryAfterMs));
  await db
    .update(ingestBatches)
    .set({
      attempts: raw`${ingestBatches.attempts} + 1`,
      lastError: error.slice(0, 2000),
      claimedAt: null,
      nextAttemptAt: raw`now() + ${delayMs} * interval '1 millisecond'`,
    })
    .where(eq(ingestBatches.batchId, batchId));
}

/** Parked batches requeued per sweep, so one sweep after a long outage is not one huge update. */
const REQUEUE_CHUNK = 1_000;

/**
 * Give parked batches back their attempts once they have cooled off.
 *
 * A parked batch used to wait for someone to reset `attempts` by hand, which in practice
 * meant forever. Most parked batches are casualties of an outage longer than the retry
 * window, and those apply fine once it is over; a batch that is genuinely poisoned fails
 * again and re-parks. `requeues` caps the cycle so the poisoned ones settle.
 *
 * The cool-off runs from `next_attempt_at` (the last failure's not-before time), falling
 * back to `created_at` for rows parked before that column existed.
 */
export async function requeueParkedBatches(
  maxAttempts: number,
  coolOffMs: number,
  maxRequeues: number,
): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    WITH due AS (
      SELECT batch_id FROM ingest_batches
      WHERE completed_at IS NULL
        AND attempts >= ${maxAttempts}
        AND requeues < ${maxRequeues}
        AND COALESCE(next_attempt_at, created_at) <= now() - ${coolOffMs} * interval '1 millisecond'
      ORDER BY created_at ASC
      LIMIT ${REQUEUE_CHUNK}
    ), requeued AS (
      UPDATE ingest_batches t
      SET attempts = 0, requeues = t.requeues + 1, next_attempt_at = NULL, claimed_at = NULL
      FROM due
      WHERE t.batch_id = due.batch_id AND t.completed_at IS NULL
      RETURNING 1
    )
    SELECT count(*)::int AS n FROM requeued`;
  return rows[0]?.n ?? 0;
}

/**
 * Close a claimed batch after its lane returned successfully.
 *
 * Most SQL lanes already perform this update in the same transaction as their write via
 * `applyBatchOnce`. Keeping this idempotent also covers successful no-op batches and
 * object-storage-only batches, which otherwise retained their lease and were redelivered
 * forever.
 */
export async function markBatchCompleted(batchId: string): Promise<void> {
  await db
    .update(ingestBatches)
    .set({ completedAt: new Date(), claimedAt: null })
    .where(and(eq(ingestBatches.batchId, batchId), isNull(ingestBatches.completedAt)));
}

/**
 * Give a claimed batch back without counting an attempt.
 *
 * For batches a worker claimed and then did not get to — a shutdown mid-drain is the only
 * caller. Leaving them leased would strand each one, and its whole partition key behind it,
 * until the lease expired.
 */
export async function releaseBatchClaims(batchIds: string[]): Promise<void> {
  if (batchIds.length === 0) return;
  await db
    .update(ingestBatches)
    .set({ claimedAt: null })
    .where(and(isNull(ingestBatches.completedAt), raw`batch_id = ANY(${batchIds})`));
}

/** Push a held lease forward while the batch is still being applied. */
export async function extendBatchClaim(batchId: string): Promise<void> {
  await db
    .update(ingestBatches)
    .set({ claimedAt: new Date() })
    .where(and(eq(ingestBatches.batchId, batchId), isNull(ingestBatches.completedAt), isNotNull(ingestBatches.claimedAt)));
}

/** Pending batches in one lane — the queue depth a health check reports. */
export async function countPendingBatches(
  lane: IngestLane,
  maxAttempts: number,
): Promise<number> {
  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(ingestBatches)
    .where(
      and(
        eq(ingestBatches.category, lane),
        isNull(ingestBatches.completedAt),
        lt(ingestBatches.attempts, maxAttempts),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Batches that exhausted their attempts — the dead-letter count.
 *
 * Worth alerting on: unlike a pending backlog, this never drains on its own.
 */
export async function countParkedBatches(maxAttempts: number): Promise<number> {
  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(ingestBatches)
    .where(and(isNull(ingestBatches.completedAt), raw`attempts >= ${maxAttempts}`));
  return row?.n ?? 0;
}

/** Rows deleted per statement, and statements per call: a prune must never be one huge delete. */
const PRUNE_CHUNK = 5_000;
const PRUNE_MAX_CHUNKS = 20;

/**
 * Drop applied batches older than the retention window.
 *
 * In chunks, counting rather than returning ids: after a busy retention window this is
 * millions of rows, and one `DELETE … RETURNING` held them all in memory and in one lock.
 * What is left over goes on the next call.
 */
export async function pruneCompletedBatches(olderThan: Date): Promise<number> {
  let total = 0;
  for (let i = 0; i < PRUNE_MAX_CHUNKS; i++) {
    const rows = await sql<{ n: number }[]>`
      WITH doomed AS (
        SELECT batch_id FROM ingest_batches
        WHERE completed_at IS NOT NULL AND completed_at < ${olderThan}
        LIMIT ${PRUNE_CHUNK}
      ), gone AS (
        DELETE FROM ingest_batches WHERE batch_id IN (SELECT batch_id FROM doomed) RETURNING 1
      )
      SELECT count(*)::int AS n FROM gone`;
    const n = rows[0]?.n ?? 0;
    total += n;
    if (n < PRUNE_CHUNK) break;
  }
  return total;
}
