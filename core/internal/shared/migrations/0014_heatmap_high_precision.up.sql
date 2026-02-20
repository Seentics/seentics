-- Migration to high-precision heatmap coordinates
ALTER TABLE heatmap_points ALTER COLUMN x_percent TYPE INTEGER;
ALTER TABLE heatmap_points ALTER COLUMN y_percent TYPE INTEGER;

-- Scale existing 0-1000 data to 0-100000 for 0.001% precision
UPDATE heatmap_points SET x_percent = x_percent * 100, y_percent = y_percent * 100;
