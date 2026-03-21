-- Store document height at recording time for accurate Y positioning on dynamic pages
ALTER TABLE heatmap_points ADD COLUMN IF NOT EXISTS doc_height INTEGER NOT NULL DEFAULT 0;
