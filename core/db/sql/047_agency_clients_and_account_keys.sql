-- Multi-tenant management: clients, client_id on websites, and account-level API keys.
--
-- A client is one of an account's own customers — an agency's client or a platform's
-- tenant — and groups some of that account's websites. external_id is the caller's id for
-- the tenant, unique per owner, so a retried signup finds the client it already created.
--
-- features_enabled switches features off per client (absent = on) and is applied on top
-- of each site's own flags when the tracker resolves a site. limits caps a client's usage
-- (absent or null = uncapped).
--
-- account_api_keys authenticate the management API. api_keys stay what they were: one
-- website, read-only.

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  external_id TEXT,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  features_enabled JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_clients_user_id ON clients (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_user_external_id
  ON clients (user_id, external_id) WHERE external_id IS NOT NULL;

-- No foreign key, like the rest of this schema: deleting a client clears its sites'
-- client_id in the same transaction (postgres-client.repository.ts).
ALTER TABLE websites ADD COLUMN IF NOT EXISTS client_id UUID;
CREATE INDEX IF NOT EXISTS ix_websites_client_id ON websites (client_id);

CREATE TABLE IF NOT EXISTS account_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_account_api_keys_user_id ON account_api_keys (user_id);
CREATE INDEX IF NOT EXISTS ix_account_api_keys_key_prefix ON account_api_keys (key_prefix);
