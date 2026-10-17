-- Agency white label and client portal access.
--
--   agency_white_label    one row per agency (the account owner): the brand its clients see
--                         on the client portal and on embeds. No row reads as the defaults.
--   agency_client_users   a client's contact, invited by the agency to that one client's
--                         read-only portal. Not a Seentics login: there is no password, only
--                         the portal links below. invited -> active on first use; revoked
--                         stops every link at once.
--   agency_portal_tokens  portal links. Only the SHA-256 of a token is stored; the token
--                         itself is shown once, to the agency, when it is made. A link is
--                         either a client user's (client_user_id set) or an anonymous link
--                         for the whole client (client_user_id NULL, "Generate link").
--
-- Everything references its owner and its client, so deleting either takes these with it.

CREATE TABLE IF NOT EXISTS agency_white_label (
  owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  brand_name VARCHAR(80) NOT NULL DEFAULT '',
  logo_url VARCHAR(1024) NOT NULL DEFAULT '',
  primary_color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  support_email VARCHAR(320) NOT NULL DEFAULT '',
  footer_text VARCHAR(200) NOT NULL DEFAULT '',
  -- Stored for the settings screen; nothing serves it yet (needs DNS and TLS at the edge).
  custom_domain VARCHAR(253) NOT NULL DEFAULT '',
  hide_seentics BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_agency_white_label_color CHECK (primary_color ~ '^#[0-9a-f]{6}$'),
  CONSTRAINT ck_agency_white_label_logo CHECK (logo_url = '' OR logo_url LIKE 'https://%')
);

CREATE TABLE IF NOT EXISTS agency_client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- Lower-cased on the way in, so the unique index below is case-insensitive.
  email VARCHAR(320) NOT NULL,
  name VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  CONSTRAINT ck_agency_client_users_status CHECK (status IN ('invited', 'active', 'revoked'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_agency_client_users_client_email ON agency_client_users (client_id, email);
CREATE INDEX IF NOT EXISTS ix_agency_client_users_owner ON agency_client_users (owner_id, created_at);

CREATE TABLE IF NOT EXISTS agency_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_user_id UUID REFERENCES agency_client_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_agency_portal_tokens_hash ON agency_portal_tokens (token_hash);
CREATE INDEX IF NOT EXISTS ix_agency_portal_tokens_client_live
  ON agency_portal_tokens (client_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_agency_portal_tokens_client_user
  ON agency_portal_tokens (client_user_id) WHERE client_user_id IS NOT NULL;
