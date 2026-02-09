-- Revert heatmap limit for Growth plan back to 1 page
UPDATE plans SET 
    max_heatmaps = 1,
    features = '["3 Websites", "200,000 Monthly Events", "5 Conversion Funnels", "5 Active Automations", "1 Active Heatmap", "1 Year Data Retention", "Priority Email Support"]'
WHERE id = 'growth';
