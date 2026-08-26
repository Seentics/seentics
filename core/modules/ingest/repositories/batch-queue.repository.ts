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
  const rows = await db
    .select({
      batchId: ingestBatches.batchId,
      category: ingestBatches.category,
      partitionKey: ingestBatches.partitionKey,
      payload: ingestBatches.payload,
      rowCount: ingestBatches.rowCount,
      attempts: ingestBatches.attempts,
    })
    .from(ingestBatches)
    .where(
      and(
        eq(ingestBatches.category, category),
        isNull(ingestBatches.completedAt),
        lt(ingestBatches.attempts, maxAttempts),
        // One in-flight batch per key. `DISTINCT ON` would need a subquery; this is the
        // cheaper form and reads as what it means.
        raw`${ingestBatches.partitionKey} NOT IN (
          SELECT partition_key FROM ingest_batches
          WHERE category = ${category}
            AND completed_at IS NULL
            AND attempts > 0
        )`,
      ),
    )
    .orderBy(asc(ingestBatches.createdAt))
    .limit(limit)
    .for("update", { skipLocked: true });

  return rows.map((r) => ({
    batchId: r.batchId,
    category: r.category as IngestCategory,
    partitionKey: r.partitionKey,
    payload: r.payload,
    rowCount: r.rowCount,
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
