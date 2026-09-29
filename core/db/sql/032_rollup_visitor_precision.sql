-- requires-extension: hll
--
-- Unique-visitor sketches at log2m 15 instead of 13.
--
-- At 13, HyperLogLog read consistently low at real traffic, not just imprecise:
-- on a site with ~242k visitors a month it said 233–237k in every 30-day window
-- tried, 1.8–3.8% under, never over. The same raw rows at 15 came within ±0.3%.
-- A sketch grows from 5 KB to 20 KB, but only for values with many visitors —
-- small ones stay in HLL's compact sparse form.
--
-- Sketches of different precisions cannot be merged, so every sketch is rebuilt:
-- the rows holding them are deleted and every day that still has raw events is
-- marked stale for the builder (modules/analytics/rollups/builder.ts), which
-- recomputes them at the new precision within minutes. A day whose raw events
-- are already gone to retention loses its visitor sketches; this runs before
-- launch, while there are none.

DELETE FROM analytics_rollup_daily;
DELETE FROM analytics_rollup_hourly;

INSERT INTO analytics_rollup_stale (website_id, day)
SELECT DISTINCT website_id, (occurred_at AT TIME ZONE 'UTC')::date
FROM analytics_events
ON CONFLICT (website_id, day) DO UPDATE SET staled_at = now();
