/**
 * Exactly-once effect for a retried batch.
 *
 * Every ingest write is retried, and none of the target tables is naturally idempotent —
 * see the note on `ingest_applied_batches` in `db/schema.ts`. This is the one mechanism
 * all of them use.
 */
export { applyBatchOnce, applyBatchOnceSql, pruneAppliedBatches } from "./applied-batches";

/**
 * Also exported from `./batch-id` directly. Import it from there when the importer must
 * stay loadable without a database — this barrel pulls in `db` through `applied-batches`.
 */
export { batchIdFor } from "./batch-id";
export type { BatchApplication, BatchTx } from "./applied-batches";
