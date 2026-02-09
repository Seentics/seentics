-- Increase heatmap limit for Growth plan from 1 to 10 pages
UPDATE plans SET 
    max_heatmaps = 10,
    features = '["3 Websites", "200,000 Monthly Events", "5 Conversion Funnels", "5 Active Automations", "10 Active Heatmaps", "1 Year Data Retention", "Priority Email Support"]'
WHERE id = 'growth';
