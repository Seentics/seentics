-- Create `outbox` here rather than leaving it to drizzle push.
--
-- The push guard in `ensure-schema.ts` lists this table and is supposed to create it,
-- but push is skippable — by env var, by `ENVIRONMENT=production` without AUTO_DB_PUSH,
-- or simply by `drizzle-kit` not being runnable in the container — and when it is
-- skipped the process starts anyway and logs "relation outbox does not exist" on every
-- poll, once a second, forever. Worse, the table is written inside the transaction that
-- creates a website, so a missing outbox took website creation down with it.
--
-- Migrations in this directory run unconditionally on every startup, which is the
-- difference between a table that is usually created and one that is.
CREATE TABLE IF NOT EXISTS outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id   text        NOT NULL,
  aggregate_type text        NOT NULL,
  event_type     text        NOT NULL,
  payload        jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz,
  attempts       integer     NOT NULL DEFAULT 0,
  last_error     text
);

-- The publisher polls `WHERE published_at IS NULL ORDER BY created_at`. A partial index
-- keeps that proportional to the backlog rather than the table, which matters because
-- published rows accumulate until they are pruned.
CREATE INDEX IF NOT EXISTS ix_outbox_unpublished
  ON outbox (created_at)
  WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_outbox_aggregate
  ON outbox (aggregate_type, aggregate_id);
