-- Outbound integrations: where a captured lead is sent (Zapier, Mailchimp, Klaviyo, HubSpot).
--
-- A connection is one provider on one website. Its credentials are encrypted by the
-- application (AES-256-GCM, see modules/integrations/lib/vault.ts) before they reach this
-- table; the column holds an opaque, versioned ciphertext and `credentials_hint` holds only
-- the last characters of the secret, which is all the dashboard ever shows back.
--
-- `status` is `active` or `error`. A connection that keeps failing is switched off by the
-- delivery service (`enabled = false`, `status = 'error'`) so a revoked key stops costing a
-- request per lead; reconnecting or re-enabling it resets the counters.
--
-- Deliveries are a bounded log, not a queue: each connection keeps its newest rows and the
-- retention sweep ages the rest out. Both tables reference their website, so deleting a
-- site erases its connections and their history with it.

CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  credentials TEXT NOT NULL,
  credentials_hint VARCHAR(8) NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_connections_website_provider_uq
  ON integration_connections (website_id, provider);

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  contact_id UUID,
  -- success | failed | skipped
  status VARCHAR(16) NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  http_status INTEGER,
  error TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_integration_deliveries_connection_created
  ON integration_deliveries (connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_integration_deliveries_website_created
  ON integration_deliveries (website_id, created_at DESC);
