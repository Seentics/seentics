-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'starter', 'growth', 'scale', 'pro_plus'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    paddle_plan_id VARCHAR(255),
    
    -- Limits
    max_monthly_events INTEGER NOT NULL DEFAULT 0, -- 0 means unlimited or handled separately
    max_websites INTEGER NOT NULL DEFAULT 1,
    max_funnels INTEGER NOT NULL DEFAULT 1,
    max_automation_rules INTEGER NOT NULL DEFAULT 1,
    max_connected_domains INTEGER NOT NULL DEFAULT 1,
    
    -- Features (Stored as JSON array for flexibility)
    features JSONB NOT NULL DEFAULT '[]',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Link to user ID from auth system
    plan_id VARCHAR(50) NOT NULL REFERENCES plans(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, past_due, canceled, trialing
    
    -- Paddle specific fields
    paddle_subscription_id VARCHAR(255),
    paddle_customer_id VARCHAR(255),
    
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
    user_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'monthly_events', 'websites', 'funnels', 'automations'
    current_count INTEGER NOT NULL DEFAULT 0,
    reset_at TIMESTAMPTZ, -- For monthly events reset
    
    PRIMARY KEY (user_id, resource_type)
);

-- Insert initial plans
INSERT INTO plans (id, name, description, price_monthly, max_monthly_events, max_websites, max_funnels, max_automation_rules, max_connected_domains, features)
VALUES 
('starter', 'Starter', 'For small websites and hobby projects', 0.00, 5000, 1, 1, 1, 1, '["Basic analytics", "Community support"]'),
('growth', 'Growth', 'For small business and startups', 19.00, 50000, 3, 5, 5, 1, '["Analytics + Funnel insights", "Email support"]'),
('scale', 'Scale', 'For growing companies and agencies', 49.00, 200000, 10, -1, 20, 5, '["Unlimited funnels", "Priority email support", "CSV export"]'),
('pro_plus', 'Pro+', 'For early adopters and high-value users', 99.00, 500000, 20, -1, -1, -1, '["Multi-user accounts", "Premium support", "Custom integrations"]');

-- Note: -1 represents unlimited
