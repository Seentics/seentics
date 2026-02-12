-- Create funnels table
CREATE TABLE funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(24) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create funnel_steps table
CREATE TABLE funnel_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    step_order INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL, -- 'page_view', 'event', 'custom'
    page_path VARCHAR(500),
    event_type VARCHAR(255),
    match_type VARCHAR(50) DEFAULT 'exact', -- 'exact', 'contains', 'starts_with', 'regex'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create funnel_analytics table (for caching funnel stats)
CREATE TABLE funnel_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    step_order INTEGER NOT NULL,
    entries INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    dropoffs INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    avg_time_to_complete INTEGER, -- seconds
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(funnel_id, date, step_order)
);

-- Create indexes for better query performance
CREATE INDEX idx_funnels_website_id ON funnels(website_id);
CREATE INDEX idx_funnels_is_active ON funnels(is_active) WHERE is_active = true;
CREATE INDEX idx_funnels_created_at ON funnels(created_at DESC);

CREATE INDEX idx_funnel_steps_funnel_id ON funnel_steps(funnel_id);
CREATE INDEX idx_funnel_steps_order ON funnel_steps(funnel_id, step_order);

CREATE INDEX idx_funnel_analytics_funnel_id ON funnel_analytics(funnel_id);
CREATE INDEX idx_funnel_analytics_date ON funnel_analytics(date DESC);
CREATE INDEX idx_funnel_analytics_funnel_date ON funnel_analytics(funnel_id, date DESC);
