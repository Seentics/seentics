-- Run if you previously added geo_latitude/geo_longitude manually (or after pulling schema without those columns).
ALTER TABLE analytics_events
  DROP COLUMN IF EXISTS geo_latitude,
  DROP COLUMN IF EXISTS geo_longitude;
