-- Partial indexes for dimension queries (sources, referrers, countries, etc.)
-- All queries on these dimensions already filter event_type = 'pageview',
-- so partial indexes keep size small while covering the hot path.

-- UTM source analytics: speeds up sources.ts which filters utm_source IS NOT NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_utm_source
  ON analytics_events (website_id, occurred_at)
  WHERE event_type = 'pageview'
    AND utm_source IS NOT NULL;

-- Referrer analytics: speeds up referrers.ts full-pageview scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_referrer
  ON analytics_events (website_id, occurred_at)
  WHERE event_type = 'pageview'
    AND referrer IS NOT NULL
    AND referrer <> '';

-- Visitor new/returning: prev_vids CTE scans ALL historic pageviews with no lower bound.
-- An index on occurred_at alone (partial on event_type) lets the planner avoid a seqscan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_occurred
  ON analytics_events (website_id, occurred_at)
  WHERE event_type = 'pageview';
