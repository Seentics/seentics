-- Preserve enough CSS-pixel and DOM-fingerprint data to remap clicks onto a
-- compatible snapshot. Existing percentage cells remain valid coordinate fallbacks.
ALTER TABLE heatmap_points
  ADD COLUMN IF NOT EXISTS page_version TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_locator JSONB,
  ADD COLUMN IF NOT EXISTS target_rect JSONB,
  ADD COLUMN IF NOT EXISTS relative_x REAL,
  ADD COLUMN IF NOT EXISTS relative_y REAL,
  ADD COLUMN IF NOT EXISTS position_mode TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS client_x REAL,
  ADD COLUMN IF NOT EXISTS client_y REAL,
  ADD COLUMN IF NOT EXISTS page_x REAL,
  ADD COLUMN IF NOT EXISTS page_y REAL,
  ADD COLUMN IF NOT EXISTS scroll_x REAL,
  ADD COLUMN IF NOT EXISTS scroll_y REAL,
  ADD COLUMN IF NOT EXISTS document_width INTEGER,
  ADD COLUMN IF NOT EXISTS document_height INTEGER,
  ADD COLUMN IF NOT EXISTS device_pixel_ratio REAL,
  ADD COLUMN IF NOT EXISTS tracker_version TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS heatmap_points_cell_uq;
CREATE UNIQUE INDEX heatmap_points_cell_uq
  ON heatmap_points (
    website_id, page_path, event_type, device_type, x_percent, y_percent,
    target_selector, page_version
  );

ALTER TABLE heatmap_points
  DROP CONSTRAINT IF EXISTS heatmap_points_relative_x_check,
  ADD CONSTRAINT heatmap_points_relative_x_check
    CHECK (relative_x IS NULL OR (relative_x >= 0 AND relative_x <= 1)),
  DROP CONSTRAINT IF EXISTS heatmap_points_relative_y_check,
  ADD CONSTRAINT heatmap_points_relative_y_check
    CHECK (relative_y IS NULL OR (relative_y >= 0 AND relative_y <= 1)),
  DROP CONSTRAINT IF EXISTS heatmap_points_position_mode_check,
  ADD CONSTRAINT heatmap_points_position_mode_check
    CHECK (position_mode IN ('normal', 'fixed', 'sticky'));

CREATE INDEX IF NOT EXISTS ix_heatmap_points_page_version
  ON heatmap_points (website_id, page_path, device_type, page_version)
  WHERE page_version <> '';

ALTER TABLE heatmap_page_snapshots
  ADD COLUMN IF NOT EXISTS dom_fingerprint TEXT NOT NULL DEFAULT '';

-- Immutable background history. `heatmap_page_snapshots` remains the selected
-- canonical background for backward-compatible reads; this table prevents a new
-- dynamic layout from destroying the older version needed by its clicks.
CREATE TABLE IF NOT EXISTS heatmap_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL,
  page_path TEXT NOT NULL,
  dom_fingerprint TEXT NOT NULL,
  device_type TEXT NOT NULL,
  viewport_width INTEGER NOT NULL,
  viewport_height INTEGER NOT NULL,
  html_s3_key TEXT,
  content_sha256 TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (website_id, page_path, device_type, dom_fingerprint)
);

CREATE INDEX IF NOT EXISTS ix_heatmap_page_versions_lookup
  ON heatmap_page_versions (website_id, page_path, device_type, last_seen_at DESC);
