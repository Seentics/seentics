-- requires-extension: hll
--
-- Re-attribute recent sessions to how they actually arrived.
--
-- The rollup builder credited a session to the alphabetically greatest channel and referrer of all
-- its pageviews, and counted a site's own other hosts and checkout/sign-in providers as sources
-- (see modules/analytics/lib/traffic-channel.ts). The builder now takes the first pageview that was
-- an arrival, but the days already rolled up keep the old answer until they are rebuilt.
--
-- Raw events are kept for 31 days, so those are the days that can be rebuilt: each is marked stale
-- and the builder redoes them in its own time, a day at a time. Older days keep what they had.
INSERT INTO analytics_rollup_stale (website_id, day)
SELECT DISTINCT website_id, day
FROM analytics_rollup_sessions
WHERE day >= (now() AT TIME ZONE 'UTC')::date - 31
ON CONFLICT DO NOTHING;
