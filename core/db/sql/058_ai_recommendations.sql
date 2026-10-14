-- Recommendations, the actions taken on them, and what changed afterwards (modules/ai/recommendations).
--
-- One row per suggestion per website. A daily collector turns what the product already found (the
-- daily insight's suggested actions, heatmap fixes, pages where recorded sessions show frustration)
-- into rows here, deduplicated by `dedupe_key` so the same suggestion from repeated daily runs is one
-- row whose `last_seen_at` moves on. An open row nobody acted on and the sources stopped suggesting is
-- expired after a while. A draft confirmed in the assistant without a recommendation behind it is
-- recorded too (`source = 'assistant'`), so every change made through the product is measured.
--
-- When one is applied, the target metric is read over the 14 days before `applied_at` (`baseline`),
-- and a daily job reads it again 7 and 14 days after (`impact.checkpoints`). Counts and rates only,
-- never visitor data.
--
-- Deleted with its website, and by the AI retention sweep once old.

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  -- insight | heatmap | session | assistant
  source VARCHAR(16) NOT NULL,
  -- Where it came from inside that source: a signal id, a page and signal, a query id.
  source_ref TEXT,
  -- Same key, same suggestion: repeated daily runs refresh one row instead of adding another.
  dedupe_key TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  -- What "Do it" types into the assistant.
  prompt TEXT NOT NULL DEFAULT '',
  -- {kind: page|funnel|channel|site, ref, label, device?}
  target JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {name: bounce_rate|conversion_rate|funnel_conversion|none, windowDays}
  metric JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- open | dismissed | applied | measuring | measured | expired
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  -- {value, numerator, volume, from, to, event?}: the metric over the 14 days before applied_at.
  baseline JSONB,
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  -- proposal: a confirmed assistant draft. manual: "I did this myself".
  applied_via VARCHAR(16),
  -- {resource: automation|funnel|goal, id}: what the confirmed draft created.
  resource JSONB,
  -- The assistant turn whose draft was confirmed.
  query_id UUID,
  -- {checkpoints: [...], sentence, sentenceSource}
  impact JSONB,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_recommendations_website_key ON ai_recommendations (website_id, dedupe_key);
-- The panel: a site's rows by status, newest first.
CREATE INDEX IF NOT EXISTS ix_ai_recommendations_website_status ON ai_recommendations (website_id, status, updated_at DESC);
-- The measuring job: applied rows across every site, oldest first.
CREATE INDEX IF NOT EXISTS ix_ai_recommendations_measuring ON ai_recommendations (applied_at) WHERE status IN ('applied', 'measuring');

-- The recommendation a chat was started from ("Do it"), so confirming its draft can mark it applied.
ALTER TABLE ai_queries ADD COLUMN IF NOT EXISTS recommendation_id UUID;
