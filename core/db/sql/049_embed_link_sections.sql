-- Which sections an embed link exposes. Read from the row on every verification, so
-- editing a link's sections changes what its (unchanged) URL can read at once.
-- Existing links keep what they always showed: analytics only.
ALTER TABLE embed_links
  ADD COLUMN IF NOT EXISTS sections TEXT[] NOT NULL DEFAULT '{analytics}';
ALTER TABLE embed_links DROP CONSTRAINT IF EXISTS ck_embed_links_sections;
ALTER TABLE embed_links
  ADD CONSTRAINT ck_embed_links_sections
  CHECK (cardinality(sections) > 0 AND sections <@ ARRAY['analytics','recordings','heatmaps']::text[]);
