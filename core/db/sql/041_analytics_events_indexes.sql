-- requires-extension: timescaledb
-- requires-preload: timescaledb
--
-- Three indexes on raw analytics events, replacing twenty.
--
-- The twenty were built when every dashboard report read raw events. Since the rollups
-- (031, 039) the dashboards, goals, custom events, event properties and revenue read
-- summaries, and raw events are compressed after 48 hours (038), where TimescaleDB keeps
-- no secondary indexes anyway (compressed batches are grouped by website and ordered by
-- visitor, then time). What still reads the uncompressed days, and what it filters by:
--
--   website + time      the rollup builder (one site-day at a time), realtime, live
--                       visitors, recent activity, funnels, export, AI, retention
--   website + session   revenue attribution: a purchase's session pageviews (rollups/
--                       revenue-orders.ts and the raw fallback)
--   website + visitor   privacy export and erasure, a visitor's own history
--
-- Every ingested event updated all twenty — about three quarters of the table's size
-- (4 GB benchmark, 037). Fewer indexes is less write work and memory per event.
--
-- It also fixes 037, which copied index definitions written for the old partitioned
-- parent (`CREATE INDEX … ON ONLY analytics_events`). ONLY kept them off every chunk:
-- the hypertable listed twenty indexes and its chunks had none. These are created
-- without it, so TimescaleDB adds them to every existing and future chunk.
--
-- On a Postgres without TimescaleDB the table keeps its twenty: without the rollups the
-- dashboards read raw events and need them.

DO $$
DECLARE
  ix TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'analytics_events'
  ) THEN
    RAISE NOTICE 'analytics_events is not a hypertable — keeping its indexes.';
    RETURN;
  END IF;

  FOR ix IN
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'analytics_events'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', ix);
  END LOOP;

  CREATE INDEX ix_ae_site_time    ON analytics_events (website_id, occurred_at DESC);
  CREATE INDEX ix_ae_site_session ON analytics_events (website_id, session_id, occurred_at DESC);
  CREATE INDEX ix_ae_site_visitor ON analytics_events (website_id, visitor_id, occurred_at DESC);
END $$;
