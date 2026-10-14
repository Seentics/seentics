-- Session analysis: frustration signals found in a recording, and a short summary of it
-- (modules/recordings/services/session-analysis.service.ts).
--
-- One row per recorded session, written once the session has gone idle by a scheduled job
-- (or on first view), from one read of the recording in object storage. Storing it means the
-- list can sort and filter by frustration, and a summary can be written later, without
-- downloading the recording again.
--
-- Holds signal types, playback offsets, masked page routes and short masked element labels
-- ("button \"Apply\""). Never typed input values or page text beyond those labels.
--
-- `website_id` is text, like `session_replays.website_id`, and keyed the same way.

CREATE TABLE IF NOT EXISTS session_analyses (
  website_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  -- Copied from the session row so "most frustrated in a date range" needs no join.
  started_at TIMESTAMPTZ NOT NULL,
  -- ready | empty (no rrweb events) | failed (the recording could not be read)
  status VARCHAR(12) NOT NULL DEFAULT 'ready',
  frustration_score SMALLINT NOT NULL DEFAULT 0,
  -- {"rage_click": 1, "dead_click": 2, ...}; only types that occurred.
  signal_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- [{type, atMs, page, label?, count?, detail?}], capped.
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Pages with dwell times, key clicks, errors, goal: the input to the summary.
  timeline JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- The session's last event (epoch ms) when this was computed; newer activity makes it stale.
  analyzed_through_ms BIGINT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- {text, intent, outcome, moments: [{atMs, label}]}; NULL until one is written.
  summary JSONB,
  -- ai | rules
  summary_source VARCHAR(8),
  -- The model that answered; NULL for a template summary written because none did.
  summary_model VARCHAR(100),
  summary_input_tokens INTEGER NOT NULL DEFAULT 0,
  summary_output_tokens INTEGER NOT NULL DEFAULT 0,
  summary_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  summary_generated_at TIMESTAMPTZ,
  -- The analysis (computed_at) the summary was written from; older than computed_at = stale.
  summary_analysis_at TIMESTAMPTZ,
  -- Last attempt, successful or not: the per-session cooldown and the guard against two
  -- requests generating the same summary at once.
  summary_attempted_at TIMESTAMPTZ,
  PRIMARY KEY (website_id, session_id)
);

-- "The most frustrated sessions on this site in a date range", worst first.
CREATE INDEX IF NOT EXISTS ix_session_analyses_site_score
  ON session_analyses (website_id, frustration_score DESC, started_at DESC)
  WHERE frustration_score > 0;

-- Per-site summary allowance: summaries written in the last day.
CREATE INDEX IF NOT EXISTS ix_session_analyses_site_summary_at
  ON session_analyses (website_id, summary_generated_at)
  WHERE summary_generated_at IS NOT NULL;

-- The analysis job's scan: session rows that started recently, across all sites. The
-- existing (website_id, sequence, timestamp) index cannot serve a cross-site range.
CREATE INDEX IF NOT EXISTS ix_session_replays_seq0_ts
  ON session_replays (timestamp)
  WHERE sequence = 0;

-- An analysis goes with its recording, whichever path deletes it: the dashboard's batch
-- delete, retention, a website's erasure or a visitor's. One trigger rather than an edit
-- to each of those paths, so a new one cannot forget.
CREATE OR REPLACE FUNCTION session_analyses_delete_with_replay() RETURNS trigger AS $$
BEGIN
  IF OLD.sequence = 0 THEN
    DELETE FROM session_analyses WHERE website_id = OLD.website_id AND session_id = OLD.session_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_analyses_delete_with_replay ON session_replays;
CREATE TRIGGER trg_session_analyses_delete_with_replay
  AFTER DELETE ON session_replays
  FOR EACH ROW EXECUTE FUNCTION session_analyses_delete_with_replay();
