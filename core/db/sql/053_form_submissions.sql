-- Form submissions and destinations, replacing the contacts inbox of 050/051.
--
-- Seentics captures what a visitor typed into a popup form and forwards it; it is not a CRM.
-- Contacts, statuses and a site-wide inbox moved out of scope, so the `contacts` table and
-- its de-duplication go. What remains:
--
--   form_submissions  one row per form submission, listed on that form's automation page and
--                     aged out after 90 days (leads module retention). It also backs the
--                     monthly plan limit, so the window must stay longer than a month.
--   form_prizes       one prize per email per popup, keyed by a hash of the address, so a
--                     returning visitor cannot re-roll a wheel and no address is kept for it.
--   integration_connections  now several per website, even several of one provider, each named.
--   integration_deliveries   a durable outbox: one row per (destination, submission), claimed
--                     by a worker, retried with back-off, and stripped of its payload once
--                     delivered. Replaces the old in-memory fire-and-forget log.
--
-- The new tables have new names (`form_*`) rather than reusing `lead_submissions`: a fresh
-- database gets its tables from the Drizzle schema first and then runs 050, which indexes
-- `lead_submissions (contact_id, …)`, so a table of that name without that column would break
-- every new install. Nothing was released on the old tables, so they are dropped, not converted.

DROP TABLE IF EXISTS integration_deliveries;
DROP TABLE IF EXISTS lead_submissions;
DROP TABLE IF EXISTS contacts;

CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  -- Checked against the website when written; no foreign key so deleting an automation
  -- does not silently erase what its visitors submitted before the retention window ends.
  automation_id UUID,
  variant VARCHAR(64),
  email VARCHAR(254) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {id, label, coupon_code} when the popup paid a reward.
  prize JSONB,
  page_url TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  session_id TEXT,
  anonymous_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_form_submissions_form_created
  ON form_submissions (website_id, automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_form_submissions_website_created
  ON form_submissions (website_id, created_at DESC);

CREATE TABLE IF NOT EXISTS form_prizes (
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL,
  -- sha256 of the lower-cased address, hex. The address itself is not stored here.
  email_hash CHAR(64) NOT NULL,
  prize JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (website_id, automation_id, email_hash)
);

DROP INDEX IF EXISTS integration_connections_website_provider_uq;
ALTER TABLE integration_connections ADD COLUMN IF NOT EXISTS name VARCHAR(80) NOT NULL DEFAULT '';
UPDATE integration_connections SET name = CASE provider
    WHEN 'zapier' THEN 'Zapier / Webhook'
    WHEN 'mailchimp' THEN 'Mailchimp'
    WHEN 'klaviyo' THEN 'Klaviyo'
    WHEN 'hubspot' THEN 'HubSpot'
    ELSE provider END
  WHERE name = '';
CREATE INDEX IF NOT EXISTS ix_integration_connections_website ON integration_connections (website_id, created_at);

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL,
  automation_id UUID,
  -- The lead as providers map from it. Cleared once delivered (or given up on after 30 days)
  -- so a finished delivery leaves metadata only.
  payload JSONB,
  -- pending | success | failed | skipped
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A claim's lease: another worker may take the row once it lapses, so a crash loses nothing.
  locked_until TIMESTAMPTZ,
  http_status INTEGER,
  error TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_deliveries_connection_submission_uq
  ON integration_deliveries (connection_id, submission_id);
CREATE INDEX IF NOT EXISTS ix_integration_deliveries_due
  ON integration_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_integration_deliveries_website_created
  ON integration_deliveries (website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_integration_deliveries_submission
  ON integration_deliveries (submission_id);
