-- Create websites table (Refined to match frontend)
CREATE TABLE IF NOT EXISTS websites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(24) UNIQUE NOT NULL, -- Public ID used in URLs
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL, -- renamed from domain
    tracking_id VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index on user_id for listing user's websites
CREATE INDEX idx_websites_user_id ON websites(user_id);

-- Add index on site_id for public lookups
CREATE INDEX idx_websites_site_id ON websites(site_id);
