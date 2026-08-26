import { eq, lt } from "drizzle-orm";
import type { TransactionSql } from "postgres";
import { db, ingestAppliedBatches, sql } from "../../db";

/**
 * The transaction a guarded write runs in.
 *
 * Exported because every repository called through `applyBatchOnce` must take it as a
 * parameter rather than reaching for the ambient `db` — that is the difference between
 * the write sharing the marker's transaction and silently escaping it.
 */
export type BatchTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What a write reports back, so the caller can tell a fresh apply from a repeat. */
export type BatchApplication = {
  /** `false` when this batch had already been applied and nothing was written. */
  applied: boolean;
  /** Rows written on a fresh apply; the previously recorded count on a repeat. */
  rowCount: number;
};

/**
 * Run a write exactly once for a given batch id, however many times it is delivered.
 *
 * The marker row and the write share one transaction, which is the whole trick: they
 * commit together or not at all, so there is no window where the batch looks applied but
 * the rows are missing. A redelivery conflicts on the primary key, `write` is never
 * called, and the caller is told nothing happened.
 *
 * `write` receives the transaction and **must** use it. Writing through the ambient `db`
 * instead would put the rows outside the marker's transaction and reintroduce exactly the
 * double-write this exists to prevent.
 *
 * Object storage is deliberately outside this guarantee: S3 puts are keyed by content or
 * by (session, sequence), so replaying one overwrites rather than duplicates. Only the
 * database effects need the marker.
 */
export async function applyBatchOnce(
  batchId: string,
  category: string,
  write: (tx: BatchTx) => Promise<number>,
): Promise<BatchApplication> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .insert(ingestAppliedBatches)
      .values({ batchId, category, rowCount: 0 })
      .onConflictDoNothing()
      .returning({ batchId: ingestAppliedBatches.batchId });

    // Someone already applied it — this delivery is a repeat.
    if (claimed.length === 0) {
      const [existing] = await tx
        .select({ rowCount: ingestAppliedBatches.rowCount })
        .from(ingestAppliedBatches)
        .where(eq(ingestAppliedBatches.batchId, batchId))
        .limit(1);
      return { applied: false, rowCount: existing?.rowCount ?? 0 };
    }

    const rowCount = await write(tx);

    // Recorded after the write so the count reflects what actually landed.
    await tx
      .update(ingestAppliedBatches)
      .set({ rowCount })
      .where(eq(ingestAppliedBatches.batchId, batchId));

    return { applied: true, rowCount };
  });
}

/** Drop markers older than the window in which a redelivery is still possible. */
export async function pruneAppliedBatches(olderThan: Date): Promise<number> {
  const deleted = await db
    .delete(ingestAppliedBatches)
    .where(lt(ingestAppliedBatches.appliedAt, olderThan))
    .returning({ batchId: ingestAppliedBatches.batchId });
  return deleted.length;
}

/**
 * `applyBatchOnce` for writers that use the raw tagged-template client.
 *
 * Drizzle and `sql` share one `postgres` client but not one transaction object, so a
 * repository built on raw SQL cannot enlist in the Drizzle transaction above — it would
 * run on a separate connection and commit independently, which is precisely the hole the
 * marker exists to close. This uses `sql.begin` so the marker and the write share a
 * transaction on the client the writer already has.
 *
 * The heatmap upsert is the reason this exists. Its `intensity = intensity +
 * EXCLUDED.intensity` is the least forgiving write in the system: a replayed batch does
 * not duplicate a row, it inflates a number, with nothing to distinguish the result from
 * real traffic.
 */
export async function applyBatchOnceSql(
  batchId: string,
  category: string,
  write: (tx: TransactionSql) => Promise<number>,
): Promise<BatchApplication> {
  const result = await sql.begin(async (tx) => {
    const claimed = await tx`
      INSERT INTO ingest_applied_batches (batch_id, category, row_count)
      VALUES (${batchId}, ${category}, 0)
      ON CONFLICT (batch_id) DO NOTHING
      RETURNING batch_id
    `;

    if (claimed.length === 0) {
      const [existing] = await tx<{ row_count: number }[]>`
        SELECT row_count FROM ingest_applied_batches WHERE batch_id = ${batchId}
      `;
      return { applied: false, rowCount: existing?.row_count ?? 0 };
    }

    const rowCount = await write(tx);

    await tx`
      UPDATE ingest_applied_batches SET row_count = ${rowCount} WHERE batch_id = ${batchId}
    `;

    return { applied: true, rowCount };
  });
  return result as unknown as BatchApplication;
}
