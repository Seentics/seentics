CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    paddle_plan_id VARCHAR(255),
    max_monthly_events INTEGER NOT NULL DEFAULT 0,
    max_websites INTEGER NOT NULL DEFAULT 1,
    max_funnels INTEGER NOT NULL DEFAULT 1,
    max_automation_rules INTEGER NOT NULL DEFAULT 1,
    max_heatmaps INTEGER NOT NULL DEFAULT 0,
    max_replays INTEGER NOT NULL DEFAULT 0,
    max_connected_domains INTEGER NOT NULL DEFAULT 1,
    features JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    plan_id VARCHAR(50) NOT NULL REFERENCES plans(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    paddle_subscription_id VARCHAR(255),
    paddle_customer_id VARCHAR(255),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_tracking (
    user_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    current_count INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, resource_type)
);

-- Initial Plan Data
INSERT INTO plans (id, name, description, price_monthly, price_yearly, max_monthly_events, max_websites, max_funnels, max_automation_rules, max_heatmaps, max_replays, features)
VALUES 
('starter', 'Starter', 'For small websites', 0.00, 0.00, 15000, 1, 1, 1, 1, 3, '["1 Website", "15,000 Monthly Events", "3 Session Recordings", "1 Heatmap"]'),
('growth', 'Growth', 'For growing sites', 29.00, 144.00, 200000, 5, 20, 20, 10, 500, '["5 Websites", "200,000 Monthly Events", "500 Session Recordings", "10 Heatmaps"]'),
('scale', 'Scale', 'For pro users', 39.00, 372.00, 1000000, 10, -1, -1, -1, 2000, '["10 Websites", "1,000,000 Monthly Events", "2,000 Session Recordings", "Unlimited Everything"]'),
('pro_plus', 'Pro+', 'Enterprise level', 99.00, 948.00, 10000000, -1, -1, -1, -1, -1, '["Unlimited Everything"]');
