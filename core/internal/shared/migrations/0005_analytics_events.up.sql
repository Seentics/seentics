CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    page TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,
    country VARCHAR(100),
    country_code VARCHAR(10),
    city VARCHAR(100),
    region VARCHAR(100),
    continent VARCHAR(100),
    browser VARCHAR(100),
    device VARCHAR(50),
    os VARCHAR(100),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content VARCHAR(255),
    time_on_page INTEGER,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    properties JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Initial Partitions
CREATE TABLE IF NOT EXISTS events_y2024m10 PARTITION OF events FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE IF NOT EXISTS events_y2024m11 PARTITION OF events FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE IF NOT EXISTS events_y2024m12 PARTITION OF events FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS events_y2025m01 PARTITION OF events FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS events_y2025m02 PARTITION OF events FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS events_y2025m03 PARTITION OF events FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS events_y2025m04 PARTITION OF events FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS events_y2025m05 PARTITION OF events FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

-- Indexes
CREATE INDEX idx_events_website_timestamp ON events(website_id, timestamp DESC);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_country_code ON events (country_code);
CREATE INDEX idx_events_dashboard_perf ON events (website_id, event_type, timestamp DESC);
CREATE INDEX idx_events_timestamp_brin ON events USING BRIN (timestamp);
CREATE INDEX idx_events_website_device_ts ON events(website_id, device, timestamp DESC) WHERE device IS NOT NULL;
CREATE INDEX idx_events_website_browser_ts ON events(website_id, browser, timestamp DESC) WHERE browser IS NOT NULL;
CREATE INDEX idx_events_website_os_ts ON events(website_id, os, timestamp DESC) WHERE os IS NOT NULL;
CREATE INDEX idx_events_website_page_ts ON events(website_id, page, timestamp DESC) WHERE page IS NOT NULL;
