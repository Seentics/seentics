-- Sessions, bounces and duration per hour (of each session's first pageview), so the dashboard's
-- totals can cover the viewer's local days exactly, as the daily chart does. NULL on hours built
-- before this: the totals use the UTC day for those, until they age out. Nothing is rebuilt.
DO $$
BEGIN
  IF to_regclass('analytics_rollup_hourly') IS NOT NULL THEN
    ALTER TABLE analytics_rollup_hourly
      ADD COLUMN IF NOT EXISTS sessions   INT,
      ADD COLUMN IF NOT EXISTS bounces    INT,
      ADD COLUMN IF NOT EXISTS duration_s BIGINT;
  END IF;
END $$;
