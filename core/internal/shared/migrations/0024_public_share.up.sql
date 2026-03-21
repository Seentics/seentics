ALTER TABLE websites ADD COLUMN IF NOT EXISTS public_share_id VARCHAR(32) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_websites_public_share_id ON websites(public_share_id) WHERE public_share_id IS NOT NULL;
