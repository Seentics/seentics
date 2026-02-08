-- Add missing composite indexes for filtered analytics queries
-- These indexes significantly improve performance when filtering by device, browser, OS, etc.

-- Index for device filtering
CREATE INDEX IF NOT EXISTS idx_events_website_device_ts 
ON events(website_id, device, timestamp DESC) 
WHERE device IS NOT NULL;

-- Index for browser filtering
CREATE INDEX IF NOT EXISTS idx_events_website_browser_ts 
ON events(website_id, browser, timestamp DESC) 
WHERE browser IS NOT NULL;

-- Index for OS filtering
CREATE INDEX IF NOT EXISTS idx_events_website_os_ts 
ON events(website_id, os, timestamp DESC) 
WHERE os IS NOT NULL;

-- Index for country filtering (enhance existing)
CREATE INDEX IF NOT EXISTS idx_events_website_country_ts 
ON events(website_id, country, timestamp DESC) 
WHERE country IS NOT NULL;

-- Composite index for UTM filtering (most common)
CREATE INDEX IF NOT EXISTS idx_events_website_utm_source_ts 
ON events(website_id, utm_source, timestamp DESC) 
WHERE utm_source IS NOT NULL;

-- Index for page path filtering
CREATE INDEX IF NOT EXISTS idx_events_website_page_ts 
ON events(website_id, page, timestamp DESC) 
WHERE page IS NOT NULL;

-- Index for live visitors query optimization (last 5 minutes)
CREATE INDEX IF NOT EXISTS idx_events_website_type_recent 
ON events(website_id, event_type, timestamp DESC) 
WHERE timestamp >= NOW() - INTERVAL '10 minutes';
