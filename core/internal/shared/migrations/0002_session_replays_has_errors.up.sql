-- Client-side JS errors / unhandled rejections during recording (latched per session).
ALTER TABLE session_replays
    ADD COLUMN IF NOT EXISTS has_errors BOOLEAN NOT NULL DEFAULT FALSE;
