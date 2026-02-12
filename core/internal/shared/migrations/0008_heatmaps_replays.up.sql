CREATE TABLE IF NOT EXISTS heatmap_points (
    website_id UUID NOT NULL,
    page_path TEXT NOT NULL,
    event_type VARCHAR(10) NOT NULL,
    device_type VARCHAR(20) NOT NULL,
    x_percent SMALLINT NOT NULL,
    y_percent SMALLINT NOT NULL,
    intensity INT DEFAULT 1,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (website_id, page_path, event_type, device_type, x_percent, y_percent)
);

CREATE TABLE IF NOT EXISTS heatmap_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    page_path TEXT NOT NULL,
    screen_width INT NOT NULL,
    screen_height INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    sequence INT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_heatmap_lookup ON heatmap_points (website_id, page_path, event_type, device_type);
CREATE INDEX idx_session_replays_session_id_seq ON session_replays(session_id, sequence);
CREATE INDEX idx_session_replays_website_id ON session_replays(website_id);
