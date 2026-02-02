-- Add reset token columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;

-- Add index for faster lookups by token
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
