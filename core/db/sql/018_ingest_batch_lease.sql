-- Make claiming an ingest batch an actual claim.
--
-- `claimPendingBatches` selected `FOR UPDATE SKIP LOCKED` through `db.execute`, which is
-- a single autocommit statement — so every lock it took was released the moment the
-- statement returned, before the worker had applied anything. Both properties the query
-- documented were therefore false: two workers could claim the same row, and two batches
-- for the same partition key could be in flight at once. The second is the one that
-- corrupts data, because replay chunk sequences are assigned per session.
--
-- A lock cannot survive its statement, so the claim has to be written down. `claimed_at`
-- is that record: the claim query now UPDATEs it and RETURNS the rows in one atomic
-- statement, and the lease it represents is what other workers honour.
--
-- Idempotent, like every file in this directory.

ALTER TABLE ingest_batches
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- The candidate scan: oldest pending batch per partition key, within one category.
--
-- Replaces `ix_ingest_batches_claim` on (category, completed_at, created_at), which could
-- not serve `DISTINCT ON (partition_key) ORDER BY partition_key, created_at` at all. The
-- planner fell back to a sequential scan followed by a full sort of the backlog — on a
-- query that runs five times a second, per category.
--
-- Measured on a 40k-row backlog across 8k partition keys: the old shape took 25.7ms and
-- sorted 3.7MB of tuples, this one takes 10.2ms with no sort node at all, because the
-- index already yields rows in the order `DISTINCT ON` wants. The gap widens with the
-- backlog, which is when it matters — a sort is O(n log n) and spills past `work_mem`,
-- while this stays a linear walk.
--
-- It is an index *scan*, not index-only: `attempts` and `batch_id` are not in the index,
-- so each row still visits the heap. Adding them with INCLUDE was tried and changed
-- nothing (`Heap Fetches: 40000`) — this table is written on every claim and completion,
-- so its visibility map is almost never all-visible and an index-only scan degrades to the
-- same heap access while costing more to maintain.
--
-- Partial on `completed_at IS NULL` so it holds only the backlog, not every batch ever
-- queued.
CREATE INDEX IF NOT EXISTS ix_ingest_batches_pending
  ON ingest_batches (category, partition_key, created_at)
  WHERE completed_at IS NULL;

DROP INDEX IF EXISTS ix_ingest_batches_claim;

-- The backstop for "at most one batch per partition key in flight".
--
-- The claim query already excludes leased partitions, and picks the *oldest* batch per
-- key — so two workers racing pick the same row and one of them loses it to SKIP LOCKED.
-- This makes that structural rather than a property of the query: if a future change ever
-- lets two different batches of one partition be claimed together, the second write fails
-- loudly instead of silently interleaving two replay chunk sequences.
--
-- Only live claims are indexed. A failed batch has its lease cleared, and a parked one
-- never holds a claim, so neither can block its partition forever.
--
-- It also serves the claim query's `leased` CTE — verified in the plan — which is why
-- there is no separate index for that. One index on a table written twice per batch is
-- worth more than two.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ingest_batches_one_inflight
  ON ingest_batches (category, partition_key)
  WHERE completed_at IS NULL AND claimed_at IS NOT NULL;
