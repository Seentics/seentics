-- Update Subscription Tiers to V4 (Final Refined Limits)

-- Starter
UPDATE plans SET 
    max_monthly_events = 15000, 
    max_websites = 1, 
    max_funnels = 1, 
    max_automation_rules = 1, 
    max_heatmaps = 1, 
    max_replays = 3,
    features = '["1 Website", "15,000 Monthly Events", "3 Session Recordings", "1 Active Heatmap", "1 Conversion Funnel", "1 Automation Workflow", "30 Days Data Retention", "Community Support"]'::jsonb,
    updated_at = NOW() 
WHERE id = 'starter';

-- Growth
UPDATE plans SET 
    price_monthly = 29.00,
    max_monthly_events = 200000, 
    max_websites = 5, 
    max_funnels = 20, 
    max_automation_rules = 20, 
    max_heatmaps = 10, 
    max_replays = 500,
    features = '["5 Websites", "200,000 Monthly Events", "500 Session Recordings", "10 Active Heatmaps", "20 Conversion Funnels", "20 Active Automations", "1 Year Data Retention", "Priority Email Support"]'::jsonb,
    updated_at = NOW() 
WHERE id = 'growth';

-- Scale
UPDATE plans SET 
    price_monthly = 89.00,
    max_monthly_events = 1000000, 
    max_websites = 15, 
    max_funnels = 100, 
    max_automation_rules = 100, 
    max_heatmaps = 50, 
    max_replays = 2500,
    features = '["15 Websites", "1,000,000 Monthly Events", "2,500 Session Recordings", "50 Active Heatmaps", "100 Conversion Funnels", "100 Active Automations", "2 Years Data Retention", "24/7 Priority Support"]'::jsonb,
    updated_at = NOW() 
WHERE id = 'scale';
