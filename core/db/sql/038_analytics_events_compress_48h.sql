-- requires-extension: timescaledb
-- requires-preload: timescaledb
--
-- Raw analytics events: uncompressed for 48 hours, compressed after, dropped at 31 days.
--
-- 48 hours, not 7 days: ingest accepts client timestamps up to 48 h back
-- (platform/http/client-timestamp.ts), so no new row lands in a chunk once it is past
-- that, and every older day is read-only. Compressed days queried as fast as plain ones
-- in the benchmark (037), at ~80 bytes an event instead of ~1.2 KB.
--
-- 31 days: funnels follow each visitor through raw events, so they offer the last 24
-- hours, 7 and 31 days and nothing longer — exact across the whole range. Raw exports
-- are held to 31 days for the same reason. Everything else reads the rollups, kept for
-- the plan's retention: the dashboard, goals and custom events (031), revenue (the
-- orders rollup, 039) and event properties. Raw events are not archived anywhere: once
-- a day is past 31 days it is gone. RAW_EVENT_DAYS in
-- modules/analytics/lib/raw-window.ts must match.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'analytics_events'
  ) THEN
    RAISE NOTICE 'analytics_events is not a hypertable — nothing to change.';
    RETURN;
  END IF;
  PERFORM remove_compression_policy('analytics_events', if_exists => true);
  PERFORM add_compression_policy('analytics_events', INTERVAL '48 hours');
  PERFORM remove_retention_policy('analytics_events', if_exists => true);
  PERFORM add_retention_policy('analytics_events', INTERVAL '31 days');
END $$;
