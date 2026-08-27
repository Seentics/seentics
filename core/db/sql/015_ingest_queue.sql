-- Durable ingest queue and its exactly-once markers.
--
-- Written as explicit SQL rather than relying on drizzle push, because push only runs
-- when the whole schema is missing (see `ensureCoreSchema`) — so on any database that
-- already has `websites`, a newly added table would never be created. `outbox` hit the
-- same gap.
--
-- Idempotent, like every file in this directory.

-- Exactly-once effect for a retried batch. The writer inserts its batch id here inside
-- the same transaction as the data, so marker and rows commit together and a redelivery
-- conflicts instead of writing twice. Matters most for `heatmap_points`, whose upsert is
-- additive: a replay inflates counts rather than duplicating rows.
CREATE TABLE IF NOT EXISTS ingest_applied_batches (
  batch_id    text PRIMARY KEY,
  category    varchar(32) NOT NULL,
  row_count   integer NOT NULL DEFAULT 0,
  applied_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_ingest_applied_at
  ON ingest_applied_batches (applied_at);

-- The queue itself. A flushed batch is a committed row before any module write is
-- attempted, so a crash costs at most the batches in flight rather than every buffer.
CREATE TABLE IF NOT EXISTS ingest_batches (
  batch_id      text PRIMARY KEY,
  category      varchar(32) NOT NULL,
  partition_key text NOT NULL,
  payload       jsonb NOT NULL,
  row_count     integer NOT NULL DEFAULT 0,
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- The claim query: pending rows of one category, oldest first.
CREATE INDEX IF NOT EXISTS ix_ingest_batches_claim
  ON ingest_batches (category, completed_at, created_at);

-- Pruning applied rows, and finding parked ones.
CREATE INDEX IF NOT EXISTS ix_ingest_batches_completed
  ON ingest_batches (completed_at);
