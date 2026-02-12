CREATE TABLE IF NOT EXISTS session_replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(24) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    sequence INT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for retrieving replay chunks for a session ordered by sequence
CREATE INDEX IF NOT EXISTS idx_session_replays_session_id_seq ON session_replays(session_id, sequence);

-- Index for website-wide replay analysis
CREATE INDEX IF NOT EXISTS idx_session_replays_website_id ON session_replays(website_id);
