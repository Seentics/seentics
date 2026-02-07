-- Update Pricing Plans with generous new limits
-- February 2026

-- Starter
UPDATE plans SET 
    price_monthly = 0.00,
    price_yearly = 0.00,
    max_monthly_events = 10000,
    max_websites = 1,
    max_funnels = 1,
    max_automation_rules = 1,
    features = '["1 Website", "10,000 Monthly Events", "1 Automation Workflow", "1 Conversion Funnel", "30 Days Data Retention", "Real-time Dashboard", "Community Support"]'
WHERE id = 'starter';

-- Growth (Updated to 200k events and $15)
UPDATE plans SET 
    price_monthly = 15.00,
    price_yearly = 144.00, -- (~$12/mo)
    max_monthly_events = 200000,
    max_websites = 3,
    max_funnels = 5,
    max_automation_rules = 5,
    features = '["3 Websites", "200,000 Monthly Events", "5 Conversion Funnels", "5 Active Automations", "1 Year Data Retention", "Priority Email Support"]'
WHERE id = 'growth';

-- Scale (Updated to 1M events and $39)
UPDATE plans SET 
    price_monthly = 39.00,
    price_yearly = 372.00, -- (~$31/mo)
    max_monthly_events = 1000000,
    max_websites = 10,
    max_funnels = -1, -- Unlimited
    max_automation_rules = -1, -- Unlimited
    features = '["10 Websites", "1,000,000 Monthly Events", "Unlimited Automations", "Unlimited Funnels", "3 Years Data Retention", "24/7 Priority Support", "API Access", "CSV Data Export"]'
WHERE id = 'scale';

-- Pro+ (Updated to 10M events and $99)
UPDATE plans SET 
    price_monthly = 99.00,
    price_yearly = 948.00, -- (~$79/mo)
    max_monthly_events = 10000000,
    max_websites = -1, -- Unlimited
    max_funnels = -1, -- Unlimited
    max_automation_rules = -1, -- Unlimited
    features = '["Unlimited Websites", "10,000,000 Monthly Events", "Unlimited Everything", "Custom Data Retention", "White-label Reports", "Dedicated Success Manager", "SSO & Custom Security"]'
WHERE id = 'pro_plus';
