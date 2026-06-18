-- Add nullable html_s3_key column to store DOM snapshot HTML alongside JPEG screenshots.
ALTER TABLE heatmap_page_snapshots
  ADD COLUMN IF NOT EXISTS html_s3_key text;
