import { and, asc, eq, isNotNull, isNull, lt, sql as raw } from "drizzle-orm";
import { db, ingestBatches } from "../../../db";
import type { IngestCategory, QueuedBatch } from "../interfaces";

/**
 * The durable queue, in Postgres.
 *
 * Every query here mirrors `infrastructure/outbox/outbox-repository.ts`, deliberately:
 * that claim-and-park pattern is already running in production in this codebase, and
 * reusing its shape means the failure modes are ones the team has already reasoned about.
 */

/**
 * Add a batch to the queue.
 *
 * `ON CONFLICT DO NOTHING` on the content-derived id makes enqueue itself idempotent, so
 * a flush that fails *after* writing the row and retries does not queue the batch twice.
 */
export async function enqueueBatch(batch: {
  batchId: string;
  category: IngestCategory;
  partitionKey: string;
  payload: Record<string, unknown>;
  rowCount: number;
}): Promise<void> {
  await db.insert(ingestBatches).values(batch).onConflictDoNothing();
}

/**
 * Claim pending batches of one category, oldest first.
 *
 * `FOR UPDATE SKIP LOCKED` lets several workers share a category without coordination —
 * each takes rows the others have not locked. The caller must complete or fail every row
 * it claims inside the same transaction, or the lock is released and another worker picks
 * the batch up while the first is still working on it.
 *
 * At most one batch per `partition_key` is returned, which is what preserves ordering
 * within a key: two batches for the same replay session can never be applied
 * concurrently, however many workers are running.
 */
export async function claimPendingBatches(
  category: IngestCategory,
  limit: number,
  maxAttempts: number,
): Promise<QueuedBatch[]> {
  // `DISTINCT ON (partition_key)` is what actually enforces the ordering guarantee: at
  // most one batch per key comes back, so two batches for the same replay session can
  // never be applied concurrently however many workers are running. An earlier version
  // used `NOT IN (… WHERE attempts > 0)`, which only excluded keys that had already
  // failed — two *fresh* batches for one session were still claimed together, and the
  // guarantee it was supposed to provide did not hold.
  //
  // The outer ordering re-sorts by age, because `DISTINCT ON` must sort by its own key
  // first. `FOR UPDATE SKIP LOCKED` on the inner select lets several workers share a
  // category without coordination — each takes rows the others have not locked.
  const rows = await db.execute<{
    batch_id: string;
    category: string;
    partition_key: string;
    payload: Record<string, unknown>;
    row_count: number;
    attempts: number;
  }>(raw`
    SELECT * FROM (
      SELECT DISTINCT ON (partition_key)
        batch_id, category, partition_key, payload, row_count, attempts, created_at
      FROM ingest_batches
      WHERE category = ${category}
        AND completed_at IS NULL
        AND attempts < ${maxAttempts}
      ORDER BY partition_key, created_at ASC
      FOR UPDATE SKIP LOCKED
    ) claimed
    ORDER BY created_at ASC
    LIMIT ${limit}
  `);

  return [...rows].map((r) => ({
    batchId: r.batch_id,
    category: r.category as IngestCategory,
    partitionKey: r.partition_key,
    payload: r.payload,
    rowCount: r.row_count,
    attempts: r.attempts,
  }));
}

/** Mark a batch applied. The sink's own marker is what makes this safe to race. */
export async function markBatchCompleted(batchId: string): Promise<void> {
  await db
    .update(ingestBatches)
    .set({ completedAt: new Date() })
    .where(eq(ingestBatches.batchId, batchId));
}

/**
 * Record a failed attempt.
 *
 * The row stays pending, so the next tick retries it. Once `attempts` reaches the cap the
 * claim query stops returning it and the batch is parked — visible to `countParked`,
 * replayable by resetting `attempts`, and never silently dropped the way the in-memory
 * flush drops a batch after three tries.
 */
export async function markBatchFailed(batchId: string, error: string): Promise<void> {
  await db
    .update(ingestBatches)
    .set({ attempts: raw`${ingestBatches.attempts} + 1`, lastError: error.slice(0, 2000) })
    .where(eq(ingestBatches.batchId, batchId));
}

/** Pending batches in one category — the queue depth a health check reports. */
export async function countPendingBatches(
  category: IngestCategory,
  maxAttempts: number,
): Promise<number> {
  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(ingestBatches)
    .where(
      and(
        eq(ingestBatches.category, category),
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

/** Drop applied batches older than the retention window. */
export async function pruneCompletedBatches(olderThan: Date): Promise<number> {
  const deleted = await db
    .delete(ingestBatches)
    .where(and(isNotNull(ingestBatches.completedAt), lt(ingestBatches.completedAt, olderThan)))
    .returning({ batchId: ingestBatches.batchId });
  return deleted.length;
}
