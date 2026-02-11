-- Migration to add max_replays column to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_replays INTEGER NOT NULL DEFAULT 0;

-- Update existing plans with default replay limits if they are still at 0
UPDATE plans SET max_replays = 3 WHERE id = 'starter' AND max_replays = 0;
UPDATE plans SET max_replays = 500 WHERE id = 'growth' AND max_replays = 0;
UPDATE plans SET max_replays = 2500 WHERE id = 'scale' AND max_replays = 0;
UPDATE plans SET max_replays = -1 WHERE id = 'pro_plus' AND max_replays = 0;
