-- Increase website_id length to avoid "value too long" errors with UUIDs
ALTER TABLE session_replays ALTER COLUMN website_id TYPE VARCHAR(64);
