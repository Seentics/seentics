-- Covering index for visitor-insights new/returning 365-day lookback.
-- Including visitor_id and session_id allows index-only scans for the
-- DISTINCT coalesce(nullif(trim(visitor_id),''), session_id) expression.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_visitor
  ON analytics_events (website_id, occurred_at DESC, visitor_id, session_id)
  WHERE event_type = 'pageview';

-- UTM medium covering index (mirrors the existing utm_source index).
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_utm_medium
  ON analytics_events (website_id, utm_medium, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND utm_medium IS NOT NULL
    AND length(trim(utm_medium)) > 0;

-- UTM campaign covering index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_utm_campaign
  ON analytics_events (website_id, utm_campaign, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND utm_campaign IS NOT NULL
    AND length(trim(utm_campaign)) > 0;

-- Session-id + referrer covering index for the referrers deduplication CTE
-- (DISTINCT ON session_id ORDER BY occurred_at used in referrers.ts and dimensions-bulk.ts).
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_session_ref
  ON analytics_events (website_id, session_id, occurred_at ASC, id ASC, referrer)
  WHERE event_type = 'pageview'
    AND session_id IS NOT NULL
    AND length(trim(session_id)) > 0;
