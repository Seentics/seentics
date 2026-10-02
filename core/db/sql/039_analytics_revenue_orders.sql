-- Revenue as one row per order, so the revenue dashboard covers any range.
--
-- Raw events are kept 31 days (038). The revenue dashboard used to compute everything
-- from them on every request — dedup by order id, last-touch attribution from the
-- session's pageviews — so past 31 days it would show nothing. The rollup builder
-- (modules/analytics/rollups/revenue-orders.ts) now does that work once per
-- website-day and stores the result here, kept like the other rollups.
--
-- One row per purchase (deduplicated within its day by order id, the same priority as
-- the dashboard) or refund. Orders are a small fraction of events, so this stays small;
-- the dashboard deduplicates again across days and aggregates exactly.
--
-- `visitor_key` is what unique customers count; visitor erasure deletes by it.

CREATE TABLE IF NOT EXISTS analytics_revenue_orders (
  website_id   TEXT             NOT NULL,
  day          DATE             NOT NULL,
  kind         TEXT             NOT NULL,   -- 'purchase' | 'refund'
  order_key    TEXT             NOT NULL,   -- order id, transaction id, or the event id
  event_id     TEXT             NOT NULL,
  event_type   TEXT             NOT NULL,
  occurred_at  TIMESTAMPTZ      NOT NULL,
  value        DOUBLE PRECISION NOT NULL,
  currency     TEXT             NOT NULL,
  user_type    TEXT             NOT NULL,
  product_name TEXT             NOT NULL,
  order_id     TEXT             NOT NULL,
  source       TEXT             NOT NULL,
  medium       TEXT             NOT NULL,
  campaign     TEXT             NOT NULL,
  country      TEXT,
  visitor_key  TEXT,
  items        JSONB,
  PRIMARY KEY (website_id, day, kind, order_key)
);

CREATE INDEX IF NOT EXISTS ix_analytics_revenue_orders_time
  ON analytics_revenue_orders (website_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_analytics_revenue_orders_visitor
  ON analytics_revenue_orders (website_id, visitor_key);

-- Backfill: rebuild every website-day still in raw events, so orders (and the new
-- event_prop rollup rows) exist for them too. The builder works through the markers
-- oldest first in the background. Only where the rollups exist (031 needs `hll`).
DO $$
BEGIN
  IF to_regclass('analytics_rollup_stale') IS NOT NULL THEN
    INSERT INTO analytics_rollup_stale (website_id, day)
    SELECT DISTINCT website_id, (occurred_at AT TIME ZONE 'UTC')::date
    FROM analytics_events
    ON CONFLICT (website_id, day) DO UPDATE SET staled_at = now();
  END IF;
END $$;
