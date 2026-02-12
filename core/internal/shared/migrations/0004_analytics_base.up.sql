CREATE TABLE IF NOT EXISTS custom_events_aggregated (
    id UUID DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
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

CREATE TABLE IF NOT EXISTS privacy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    data JSONB
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_events_website_signature ON custom_events_aggregated (website_id, event_signature, last_seen);
CREATE INDEX idx_privacy_requests_website_id ON privacy_requests(website_id);
CREATE INDEX idx_sessions_website_start ON sessions(website_id, start_time);
