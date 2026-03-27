CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id   VARCHAR(64)  NOT NULL,
    user_id      VARCHAR(255) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    key_hash     VARCHAR(64)  NOT NULL UNIQUE,  -- SHA-256 hex of the raw key
    key_prefix   VARCHAR(16)  NOT NULL,          -- first 16 chars shown in UI
    scopes       TEXT[]       NOT NULL DEFAULT '{"read"}',
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_website_id ON api_keys(website_id);
CREATE INDEX idx_api_keys_key_hash   ON api_keys(key_hash);
