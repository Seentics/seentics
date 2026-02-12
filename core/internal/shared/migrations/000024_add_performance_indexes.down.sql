-- Rollback performance indexes

DROP INDEX CONCURRENTLY IF EXISTS idx_events_website_device_ts;
DROP INDEX CONCURRENTLY IF EXISTS idx_events_website_browser_ts;
DROP INDEX CONCURRENTLY IF EXISTS idx_events_website_os_ts;
DROP INDEX CONCURRENTLY IF EXISTS idx_events_website_country_ts;
DROP INDEX CONCURRENTLY IF EXISTS idx_events_website_utm_source_ts;
DROP INDEX CONCURRENTLY IF EXISTS idx_events_website_page_ts;
DROP INDEX CONCURRENTLY IF EXISTS idx_events_website_type_recent;
