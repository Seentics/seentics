-- Session-scoped indexes for faster aggregation and join queries.
-- analytics_events is a partitioned table so plain CREATE INDEX is used.

CREATE INDEX IF NOT EXISTS ix_analytics_session_visitor
  ON analytics_events (website_id, session_id, occurred_at DESC)
  WHERE session_id IS NOT NULL AND length(trim(session_id)) > 0;

CREATE INDEX IF NOT EXISTS ix_analytics_visitor_id
  ON analytics_events (website_id, visitor_id, occurred_at DESC)
  WHERE visitor_id IS NOT NULL AND length(trim(visitor_id)) > 0;
