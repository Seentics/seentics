-- Update Pricing Plans with new limits and prices

-- Starter
UPDATE plans SET 
    price_monthly = 0.00,
    max_monthly_events = 5000,
    max_websites = 1,
    max_funnels = 1,
    max_automation_rules = 1,
    features = '["1 Website", "5,000 Monthly Events", "1 Automation Workflow", "1 Conversion Funnel", "30 Days Data Retention", "Real-time Dashboard", "Community Support"]'
WHERE id = 'starter';

-- Growth
UPDATE plans SET 
    price_monthly = 15.00,
    max_monthly_events = 100000,
    max_websites = 3,
    max_funnels = 10,
    max_automation_rules = 10,
    features = '["3 Websites", "100,000 Monthly Events", "10 Conversion Funnels", "10 Active Automations", "1 Year Data Retention", "Priority Email Support"]'
WHERE id = 'growth';

-- Scale
UPDATE plans SET 
    price_monthly = 39.00,
    max_monthly_events = 500000,
    max_websites = 10,
    max_funnels = -1, -- Unlimited Funnels
    max_automation_rules = -1, -- Unlimited Automations
    features = '["10 Websites", "500,000 Monthly Events", "Unlimited Automations", "Unlimited Funnels", "3 Years Data Retention", "24/7 Priority Support", "API Access"]'
WHERE id = 'scale';

-- Pro+
UPDATE plans SET 
    price_monthly = 149.00,
    max_monthly_events = 5000000,
    max_websites = 50,
    max_funnels = -1, -- Unlimited
    max_automation_rules = -1, -- Unlimited
    features = '["50 Websites", "5,000,000 Monthly Events", "Unlimited Everything", "Custom Data Retention", "White-label Reports", "Dedicated Success Manager", "SSO & Custom Security"]'
WHERE id = 'pro_plus';
