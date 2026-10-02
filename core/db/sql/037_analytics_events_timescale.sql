-- requires-extension: timescaledb
-- requires-preload: timescaledb
--
-- Raw analytics events as a TimescaleDB hypertable: 30 days of raw events, every day
-- older than a week compressed in place, everything older than 30 days dropped.
--
-- Why: raw events cost ~1.2 KB each on disk, three quarters of it the ~20 secondary
-- indexes the dashboard queries need. Measured on the 4 GB benchmark stack (3.2M events
-- over 90 days, tools/benchmarks): compressed days take ~80 bytes per event (~20x
-- smaller), stay queryable with the same SQL, and 30-day queries ran as fast or faster
-- (top pages 105 → 78 ms, one visitor's timeline 99 → 29 ms). Beyond 30 days the
-- dashboards read the daily rollups (031), which are kept for the plan's retention.
--
-- Compressed batches are grouped by website and ordered by visitor, then time. The
-- visitor order is what makes a GDPR erasure workable: each batch records its visitor
-- range, so deleting one visitor (`visitor_id = $1`) decompresses only the batches that
-- can hold them — 3 s instead of decompressing the whole site (1.9M rows) and failing.
--
-- Skipped, and retried on a later start, on a Postgres without TimescaleDB installed and
-- preloaded: the table then stays the monthly-partitioned one from 007.

CREATE EXTENSION IF NOT EXISTS timescaledb;

DO $$
DECLARE
  def TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'analytics_events'
  ) THEN
    RAISE NOTICE 'analytics_events is already a hypertable — skipping conversion.';
    RETURN;
  END IF;

  -- The indexes, captured before the rename so they still name analytics_events.
  -- A hypertable cannot hold a unique index without the time column; none exists
  -- today, and one added later is reported rather than silently dropped.
  CREATE TEMP TABLE _ae_index_defs ON COMMIT DROP AS
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'analytics_events';
  IF EXISTS (SELECT 1 FROM _ae_index_defs WHERE indexdef ILIKE 'CREATE UNIQUE%') THEN
    RAISE EXCEPTION 'analytics_events has a unique index without occurred_at; '
      'a hypertable cannot keep it — drop or extend it, then restart.';
  END IF;

  ALTER TABLE analytics_events RENAME TO analytics_events_partitioned;

  CREATE TABLE analytics_events (LIKE analytics_events_partitioned INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
  PERFORM create_hypertable(
    'analytics_events', 'occurred_at',
    chunk_time_interval => INTERVAL '1 day',
    create_default_indexes => false
  );

  -- Loaded before the indexes exist: one sorted build per index afterwards instead of
  -- maintaining twenty of them row by row (a 3M-row copy took 10 minutes that way).
  INSERT INTO analytics_events SELECT * FROM analytics_events_partitioned;
  DROP TABLE analytics_events_partitioned CASCADE;

  FOR def IN SELECT indexdef FROM _ae_index_defs LOOP
    EXECUTE def;
  END LOOP;
END $$;

ALTER TABLE analytics_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'website_id',
  timescaledb.compress_orderby   = 'visitor_id, occurred_at DESC'
);
SELECT add_compression_policy('analytics_events', INTERVAL '7 days', if_not_exists => true);
SELECT add_retention_policy('analytics_events', INTERVAL '30 days', if_not_exists => true);

-- 007's monthly partition helper still runs on every start (db/ensure-schema.ts); on a
-- hypertable there are no partitions to create, so it does nothing.
CREATE OR REPLACE FUNCTION ensure_analytics_partitions(months_ahead INT DEFAULT 3)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RETURN;
END $$;
