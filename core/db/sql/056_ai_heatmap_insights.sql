-- Heatmap insights: the few plain-English findings and fixes shown beside one page's heatmap
-- (modules/heatmaps analyses the page; modules/ai/heatmap-insights words it).
--
-- One row per website, page, device bucket and window. Worded on demand when the heatmap is
-- opened and kept, so reopening the page reads the stored wording instead of calling a model;
-- regenerated once it is a day old, or sooner on a refresh (rate-limited by the service).
--
-- `findings` is what the owner sees; `signals` is what the code found and the findings were
-- worded from (ids and their compact facts), kept so a finding can be traced to its numbers. No
-- visitor data: counts, percentages, element selectors and sentences.
--
-- Deleted with its website, and by the AI retention sweep once old.

CREATE TABLE IF NOT EXISTS ai_heatmap_insights (
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  page_path TEXT NOT NULL,
  -- all | desktop | tablet | mobile
  device VARCHAR(10) NOT NULL,
  days INTEGER NOT NULL,
  -- ai: worded by the model. rules: worded from templates (the model failed, or its output failed the checks).
  source VARCHAR(8) NOT NULL DEFAULT 'rules',
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- The signal ids the wording was for, so a changed set of signals is reworded.
  signal_key TEXT NOT NULL DEFAULT '',
  reason TEXT,
  model VARCHAR(100),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (website_id, page_path, device, days)
);

-- The per-site daily cap counts a site's recent rows; retention deletes old ones.
CREATE INDEX IF NOT EXISTS ix_ai_heatmap_insights_website_created ON ai_heatmap_insights (website_id, created_at);
