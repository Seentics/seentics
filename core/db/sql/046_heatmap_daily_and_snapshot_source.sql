-- Heatmap cells per day, so a heatmap can be read over a date range and retention can
-- drop whole days.
--
-- A cell used to be a running total: every click on it added to one row and refreshed
-- `last_updated`, so a busy element never aged out and its count held clicks from long
-- before the retention window. Existing rows are dated by their last update, the best
-- record there is of when they were clicked.
ALTER TABLE heatmap_points ADD COLUMN IF NOT EXISTS day DATE;
UPDATE heatmap_points SET day = (last_updated AT TIME ZONE 'UTC')::date WHERE day IS NULL;
ALTER TABLE heatmap_points
  ALTER COLUMN day SET DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  ALTER COLUMN day SET NOT NULL;

DROP INDEX IF EXISTS heatmap_points_cell_uq;
CREATE UNIQUE INDEX heatmap_points_cell_uq
  ON heatmap_points (
    website_id, page_path, event_type, device_type, x_percent, y_percent,
    target_selector, page_version, day
  );

-- Reads filter a page's cells by day; retention deletes a site's old days.
DROP INDEX IF EXISTS ix_heatmap_points_website_page_event;
CREATE INDEX IF NOT EXISTS ix_heatmap_points_website_page_event_day
  ON heatmap_points (website_id, page_path, event_type, day);
DROP INDEX IF EXISTS ix_heatmap_points_website_updated;
CREATE INDEX IF NOT EXISTS ix_heatmap_points_website_day
  ON heatmap_points (website_id, day);

-- The real page a background was captured on. A parameterised path (/orders/:id) is many
-- pages sharing one background, and the dashboard says which one it is showing.
ALTER TABLE heatmap_page_snapshots ADD COLUMN IF NOT EXISTS source_path TEXT NOT NULL DEFAULT '';

-- When a visitor's capture last confirmed the stored background, whether or not it
-- replaced it (identical, or a shorter view of a page whose taller capture is kept).
-- The tracker asks for a capture only when this and `updated_at` are both over a day
-- old, so a page is captured about once a day rather than once per visitor. Separate
-- from `updated_at` because that one ages the background itself out.
ALTER TABLE heatmap_page_snapshots ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
