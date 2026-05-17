-- Rename analytics_events.site key column (Drizzle: websiteId → website_id).
-- Wrapped in DO block for idempotency: no-op if column already has the right name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'analytics_events'
      AND column_name  = 'website_site_id'
  ) THEN
    ALTER TABLE analytics_events RENAME COLUMN website_site_id TO website_id;
  END IF;
END $$;
