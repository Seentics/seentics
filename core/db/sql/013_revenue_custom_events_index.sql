-- Revenue analytics: partial index for the legacy custom-event branch.
-- 004_revenue_indexes.sql only covers promoted event types (event_type IN
-- ('purchase', …)); revenue.ts also scans legacy rows stored as
-- event_type='custom' with the semantic name in properties->>'name'.
-- The predicate matches the exact expression used in revenue.ts so the
-- planner can use this index for that OR-branch.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_analytics_revenue_custom_events
  ON analytics_events (website_id, occurred_at DESC)
  WHERE event_type = 'custom'
    AND lower(properties->>'name') IN (
      'purchase',
      'order_completed',
      'checkout_completed',
      'ecommerce_purchase',
      'transaction',
      'refund',
      'refunded'
    );
