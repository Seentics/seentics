ALTER TABLE heatmap_points
    ADD COLUMN IF NOT EXISTS target_selector TEXT NOT NULL DEFAULT '';

ALTER TABLE heatmap_points DROP CONSTRAINT IF EXISTS heatmap_points_pkey;

ALTER TABLE heatmap_points
    ADD PRIMARY KEY (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector);
