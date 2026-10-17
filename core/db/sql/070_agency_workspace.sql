-- The agency workspace, phase 1 (docs/agency-workspace.md).
--
--   client_members      a client user's membership of one client. The gateway writes it when
--                       the agency invites someone (client sign-in, phase 2); Core reads it
--                       for the setup guide now and for client-scoped access later. One row
--                       per (client, user); deleting the client or the user takes it along.
--   clients             `features_enabled` becomes `collect_features` (what the tracker may
--                       collect), `dashboard_features` is new (which dashboard pages a client
--                       user may open: off | view | edit), and `archived` joins the statuses.
--                       `limits` stays: the gateway's ingest quota reads it until phase 4
--                       replaces it with per-client caps.
--   agency_white_label  `slug` names the agency on seentics.com's client sign-in.
--   agency_alerts       what the overview lists: caps at 80% / 100% (phase 4) and sites whose
--                       tracking stopped. One row per (owner, client, website, kind, resource,
--                       period), NULLs equal, so raising an alert twice is a no-op.
--
-- The read-only portal is gone (client sign-in replaces it in phase 2): its tables,
-- agency_client_users and agency_portal_tokens, are dropped.

DROP TABLE IF EXISTS agency_portal_tokens;
DROP TABLE IF EXISTS agency_client_users;

CREATE TABLE IF NOT EXISTS client_members (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'invited',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  PRIMARY KEY (client_id, user_id),
  CONSTRAINT ck_client_members_status CHECK (status IN ('invited', 'active', 'disabled'))
);
CREATE INDEX IF NOT EXISTS ix_client_members_user ON client_members (user_id);
CREATE INDEX IF NOT EXISTS ix_client_members_owner ON client_members (owner_id);

-- A database that drizzle pushed from the current schema already has the new name.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'features_enabled') THEN
    ALTER TABLE clients RENAME COLUMN features_enabled TO collect_features;
  END IF;
END $$;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS collect_features JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dashboard_features JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE clients SET status = 'active' WHERE status NOT IN ('active', 'suspended', 'archived');
ALTER TABLE clients DROP CONSTRAINT IF EXISTS ck_clients_status;
ALTER TABLE clients ADD CONSTRAINT ck_clients_status CHECK (status IN ('active', 'suspended', 'archived'));

ALTER TABLE agency_white_label ADD COLUMN IF NOT EXISTS slug VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS ux_agency_white_label_slug ON agency_white_label (slug);
ALTER TABLE agency_white_label DROP CONSTRAINT IF EXISTS ck_agency_white_label_slug;
ALTER TABLE agency_white_label
  ADD CONSTRAINT ck_agency_white_label_slug CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]{3,40}$');

CREATE TABLE IF NOT EXISTS agency_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
  kind VARCHAR(24) NOT NULL,
  -- events | recordings | leads | ai_analyses; '' for tracking_stopped.
  resource VARCHAR(24) NOT NULL DEFAULT '',
  -- The UTC month (its first day) for a cap alert; the day for tracking_stopped.
  period DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  CONSTRAINT ck_agency_alerts_kind CHECK (kind IN ('cap_80', 'cap_100', 'tracking_stopped'))
);
-- A constraint, so ON CONFLICT ON CONSTRAINT can name it; NULLS NOT DISTINCT so an
-- account-wide or client-wide alert (website_id NULL) still conflicts with itself.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ux_agency_alerts_once') THEN
    ALTER TABLE agency_alerts ADD CONSTRAINT ux_agency_alerts_once
      UNIQUE NULLS NOT DISTINCT (owner_id, client_id, website_id, kind, resource, period);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_agency_alerts_owner_open
  ON agency_alerts (owner_id, created_at) WHERE dismissed_at IS NULL;
