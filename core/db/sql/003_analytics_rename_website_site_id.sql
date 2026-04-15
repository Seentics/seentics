-- Rename analytics_events.site key column (Drizzle: websiteId → website_id).
ALTER TABLE analytics_events
  RENAME COLUMN website_site_id TO website_id;
