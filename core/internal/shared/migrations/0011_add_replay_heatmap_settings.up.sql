-- Add missing columns for heatmaps and replays to the websites table
ALTER TABLE websites 
ADD COLUMN IF NOT EXISTS heatmap_include_patterns TEXT,
ADD COLUMN IF NOT EXISTS heatmap_exclude_patterns TEXT,
ADD COLUMN IF NOT EXISTS replay_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS replay_sampling_rate DOUBLE PRECISION DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS replay_include_patterns TEXT,
ADD COLUMN IF NOT EXISTS replay_exclude_patterns TEXT;
