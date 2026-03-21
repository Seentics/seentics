-- Add rage-click detection fields to session_replays.
-- has_rage_clicks:          set TRUE by the background worker when detected.
-- rage_clicks_processed:    set TRUE once the worker has finished analysing a session.
ALTER TABLE session_replays
    ADD COLUMN IF NOT EXISTS has_rage_clicks        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS rage_clicks_processed  BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index for the rage-click worker: only rows that are the session root
-- (sequence = 0) and have not been processed yet.
CREATE INDEX IF NOT EXISTS idx_session_replay_unprocessed_rc
    ON session_replays (timestamp)
    WHERE sequence = 0 AND rage_clicks_processed = FALSE;
