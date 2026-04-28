-- Revenue analytics: partial index covering only purchase/refund event types.
-- Dramatically reduces scan size for revenue queries on large tables.
-- CONCURRENTLY avoids locking the table during creation.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_revenue_events
  ON analytics_events (website_id, occurred_at DESC)
  WHERE event_type IN (
    'purchase',
    'order_completed',
    'checkout_completed',
    'ecommerce_purchase',
    'transaction',
    'refund',
    'refunded'
  );

-- Attribution join: find the last non-direct pageview (with utm_source) before a purchase.
-- The revenue service joins analytics_events on (website_id, session_id, occurred_at)
-- filtered to pageview + utm_source IS NOT NULL. This index serves that join.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_pageview_session_occurred
  ON analytics_events (website_id, session_id, occurred_at DESC)
  WHERE event_type = 'pageview'
    AND session_id IS NOT NULL;
