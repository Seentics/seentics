-- Initial schema for analytics service (PostgreSQL compatible)
-- Consolidated schema with all required tables and proper field sizes

-- Create events table (partitioned by timestamp for better performance)
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid(),
    website_id VARCHAR(24) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    page TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,
    country VARCHAR(100),
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
    properties JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);


-- Create custom_events_aggregated table for custom events analytics
CREATE TABLE custom_events_aggregated (
    id UUID DEFAULT gen_random_uuid(),
    website_id VARCHAR(24) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_signature VARCHAR(64) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    sample_properties JSONB,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, last_seen)
);

-- Create privacy_requests table for GDPR compliance
CREATE TABLE privacy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(24) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    data JSONB
);

-- Create indexes for better query performance
CREATE INDEX idx_events_website_timestamp ON events(website_id, timestamp DESC);
CREATE INDEX idx_events_visitor_id ON events(visitor_id);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_page ON events(page) WHERE page IS NOT NULL;
CREATE INDEX idx_events_utm_source ON events(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX idx_events_utm_campaign ON events(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX idx_events_country ON events(country) WHERE country IS NOT NULL;

CREATE INDEX idx_custom_events_aggregated_website_signature ON custom_events_aggregated (website_id, event_signature, last_seen);
CREATE INDEX idx_custom_events_last_seen ON custom_events_aggregated(last_seen);
CREATE INDEX idx_privacy_requests_website_id ON privacy_requests(website_id);

-- Create initial partitions for events table (PostgreSQL native partitioning)
-- This provides similar benefits to specialized time-series databases for time-series data
CREATE TABLE events_y2024m10 PARTITION OF events FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE events_y2024m11 PARTITION OF events FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE events_y2024m12 PARTITION OF events FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE events_y2025m01 PARTITION OF events FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE events_y2025m02 PARTITION OF events FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE events_y2025m03 PARTITION OF events FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
