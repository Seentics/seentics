-- Add script toggle flags to websites table
ALTER TABLE websites 
ADD COLUMN automation_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN funnel_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN heatmap_enabled BOOLEAN NOT NULL DEFAULT true;
