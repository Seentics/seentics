-- Remove updated_at from usage_tracking
ALTER TABLE usage_tracking DROP COLUMN IF EXISTS updated_at;

-- Drop sessions table
DROP TABLE IF EXISTS sessions;
