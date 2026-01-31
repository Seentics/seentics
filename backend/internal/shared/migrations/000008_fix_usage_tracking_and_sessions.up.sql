-- Add updated_at to usage_tracking
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Fix usage_tracking PRIMARY KEY if needed (it should already be user_id, resource_type)
-- It was: PRIMARY KEY (user_id, resource_type)

-- Create sessions table if it doesn't exist to prevent SQL errors in visitor_insights
-- Note: It's better to fix the repository to calculate this from events, 
-- but we provide the table as a fallback.
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(24) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index to sessions
CREATE INDEX IF NOT EXISTS idx_sessions_website_start ON sessions(website_id, start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON sessions(visitor_id);
