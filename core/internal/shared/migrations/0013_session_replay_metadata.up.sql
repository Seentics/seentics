-- Add session metadata columns to session_replays.
-- Only populated for sequence=0 (the first chunk of each session).
ALTER TABLE session_replays
    ADD COLUMN IF NOT EXISTS browser    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS device     VARCHAR(50),
    ADD COLUMN IF NOT EXISTS os         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS country    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS entry_page TEXT;

-- Prevent duplicate chunks on tracker retry
ALTER TABLE session_replays
    ADD CONSTRAINT uq_session_replay_chunk
    UNIQUE (website_id, session_id, sequence);
