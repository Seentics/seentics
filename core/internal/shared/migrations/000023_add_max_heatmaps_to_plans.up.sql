-- Add max_heatmaps to plans table
ALTER TABLE plans ADD COLUMN max_heatmaps INTEGER NOT NULL DEFAULT 0;

-- Update Starter (No Heatmaps)
UPDATE plans SET 
    max_heatmaps = 0,
    features = '["1 Website", "10,000 Monthly Events", "1 Automation Workflow", "1 Conversion Funnel", "No Heatmap Data", "30 Days Data Retention", "Real-time Dashboard", "Community Support"]'
WHERE id = 'starter';

-- Update Growth (1 Heatmap)
UPDATE plans SET 
    max_heatmaps = 1,
    features = '["3 Websites", "200,000 Monthly Events", "5 Conversion Funnels", "5 Active Automations", "1 Active Heatmap", "1 Year Data Retention", "Priority Email Support"]'
WHERE id = 'growth';

-- Update Scale (Unlimited Heatmaps)
UPDATE plans SET 
    max_heatmaps = -1,
    features = '["10 Websites", "1,000,000 Monthly Events", "Unlimited Automations", "Unlimited Funnels", "Unlimited Heatmaps", "3 Years Data Retention", "24/7 Priority Support", "API Access", "CSV Data Export"]'
WHERE id = 'scale';

-- Update Pro+ (Unlimited Heatmaps)
UPDATE plans SET 
    max_heatmaps = -1,
    features = '["Unlimited Websites", "10,000,000 Monthly Events", "Unlimited Everything", "Custom Data Retention", "White-label Reports", "Dedicated Success Manager", "SSO & Custom Security"]'
WHERE id = 'pro_plus';
