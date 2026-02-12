-- Allow 1 Heatmap on Starter Plan
UPDATE plans SET 
    max_heatmaps = 1,
    features = '["1 Website", "10,000 Monthly Events", "1 Automation Workflow", "1 Conversion Funnel", "1 Active Heatmap", "30 Days Data Retention", "Real-time Dashboard", "Community Support"]'
WHERE id = 'starter';
