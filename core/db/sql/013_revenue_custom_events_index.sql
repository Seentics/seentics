-- Revenue analytics partial index for the legacy custom-event branch.
-- 004_revenue_indexes covers promoted event types only. The revenue service also
-- scans legacy rows stored as event_type custom with the semantic name in
-- properties name. This predicate matches that branch so the planner can use it.
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
