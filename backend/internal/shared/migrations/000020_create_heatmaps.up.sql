-- Create heatmaps table for efficient aggregated tracking
CREATE TABLE IF NOT EXISTS heatmap_points (
    website_id UUID NOT NULL,
    page_path TEXT NOT NULL,
    event_type VARCHAR(10) NOT NULL, -- 'click' or 'move'
    device_type VARCHAR(20) NOT NULL, -- 'desktop', 'tablet', 'mobile'
    x_percent SMALLINT NOT NULL, -- 0 to 1000 (representing 0.0% to 100.0%)
    y_percent SMALLINT NOT NULL, -- 0 to 65535 (vertical pages can be very long)
    intensity INT DEFAULT 1,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (website_id, page_path, event_type, device_type, x_percent, y_percent)
);

-- Index for fast lookup when rendering heatmaps for a specific page
CREATE INDEX IF NOT EXISTS idx_heatmap_lookup ON heatmap_points (website_id, page_path, event_type, device_type);

-- Table for heatmap session metadata (optional, for future recording playback)
CREATE TABLE IF NOT EXISTS heatmap_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    page_path TEXT NOT NULL,
    screen_width INT NOT NULL,
    screen_height INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
