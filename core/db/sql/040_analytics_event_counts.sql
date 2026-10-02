-- Events stored per website and UTC day, kept up to date by ingest.
--
-- The gateway checks each account's monthly event quota every two minutes per active
-- account. It summed the rollups for past days but counted today's raw events, which
-- grows through the day: in the 4 GB benchmark, with a few hundred thousand events
-- today, a dozen concurrent copies of that count took 2–5 s each and every ingest
-- request queued behind them. Ingest now adds each batch's rows here, in the batch's
-- own transaction (modules/analytics/repositories/analytics-batch.repository.ts), so
-- the month is a sum of at most 31 rows per website at any hour, and exact.
--
-- Not reduced when events are erased or expire: it counts what was ingested, which is
-- what the quota measures.

CREATE TABLE IF NOT EXISTS analytics_event_counts (
  website_id TEXT   NOT NULL,
  day        DATE   NOT NULL,
  events     BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (website_id, day)
);

-- Backfill from what is still stored, so the current month is right from the first
-- start (the gateway sums only this table once it exists).
INSERT INTO analytics_event_counts (website_id, day, events)
SELECT website_id, (occurred_at AT TIME ZONE 'UTC')::date, count(*)
FROM analytics_events
GROUP BY 1, 2
ON CONFLICT (website_id, day) DO NOTHING;
