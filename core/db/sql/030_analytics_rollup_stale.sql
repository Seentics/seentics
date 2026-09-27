-- Website-days whose analytics rollups are stale.
--
-- Ingest upserts here in the same transaction as the events it writes; the rollup
-- builder (modules/analytics/rollups/builder.ts) rebuilds the day and clears what it
-- covered. Separate from the rollup tables themselves (031) because ingest writes it on
-- every install, while the rollups need the `hll` extension and are skipped on a
-- Postgres without it.

CREATE TABLE IF NOT EXISTS analytics_rollup_stale (
  website_id TEXT NOT NULL,
  day        DATE NOT NULL,
  staled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (website_id, day)
);
