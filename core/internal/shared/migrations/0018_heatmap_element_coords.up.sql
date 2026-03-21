-- Add element-relative click coordinates.
-- el_x / el_y store the click position normalised to 0-1000 within the
-- clicked element's bounding rect (only meaningful for click-type events).
-- Default -1 = not available (legacy rows recorded before this migration).
ALTER TABLE heatmap_points
    ADD COLUMN IF NOT EXISTS el_x SMALLINT NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS el_y SMALLINT NOT NULL DEFAULT -1;
