-- Migration to remove max_replays column from plans table
ALTER TABLE plans DROP COLUMN IF EXISTS max_replays;
