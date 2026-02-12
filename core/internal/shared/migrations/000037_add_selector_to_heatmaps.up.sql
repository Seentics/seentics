-- Add target_selector to heatmap_points for element-specific tracking
ALTER TABLE heatmap_points ADD COLUMN IF NOT EXISTS target_selector TEXT DEFAULT '';

-- Update Primary Key to include target_selector
ALTER TABLE heatmap_points DROP CONSTRAINT heatmap_points_pkey;
ALTER TABLE heatmap_points ADD PRIMARY KEY (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector);
