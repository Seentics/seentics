-- Revert target_selector addition
ALTER TABLE heatmap_points DROP CONSTRAINT heatmap_points_pkey;
ALTER TABLE heatmap_points ADD PRIMARY KEY (website_id, page_path, event_type, device_type, x_percent, y_percent);
ALTER TABLE heatmap_points DROP COLUMN IF NOT EXISTS target_selector;
