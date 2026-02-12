-- Drop all tables and indexes created in the initial schema

-- Drop indexes first
DROP INDEX IF EXISTS idx_events_website_timestamp;
DROP INDEX IF EXISTS idx_events_visitor_id;
DROP INDEX IF EXISTS idx_events_session_id;
DROP INDEX IF EXISTS idx_events_event_type;
DROP INDEX IF EXISTS idx_events_page;
DROP INDEX IF EXISTS idx_events_utm_source;
DROP INDEX IF EXISTS idx_events_utm_campaign;
DROP INDEX IF EXISTS idx_events_country;

DROP INDEX IF EXISTS idx_custom_events_aggregated_website_signature;
DROP INDEX IF EXISTS idx_custom_events_last_seen;
DROP INDEX IF EXISTS idx_privacy_requests_website_id;

-- Drop tables
DROP TABLE IF EXISTS privacy_requests;
DROP TABLE IF EXISTS custom_events_aggregated;
DROP TABLE IF EXISTS events;
