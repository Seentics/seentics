-- Add heatmap include and exclude patterns to websites
ALTER TABLE websites ADD COLUMN IF NOT EXISTS heatmap_include_patterns TEXT;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS heatmap_exclude_patterns TEXT;
