-- Lead capture: contacts and the submissions behind them.
--
-- A contact is one email address on one website, the row the dashboard inbox lists. It is
-- de-duplicated on (website_id, email): a returning visitor who submits again raises
-- `submission_count` and refreshes the contact instead of adding a second row.
--
-- Every submission is kept as its own row, because the contact alone cannot answer "which
-- popup, which A/B variant, which page" — and that attribution is the reason to capture
-- leads in the same product as the analytics.
--
-- Both tables reference their website, so deleting a site erases its leads with it. The
-- retention sweep deliberately does not touch them: they are customer records the site
-- owner collected, not analytics events, and age out only when the owner deletes them.

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  email VARCHAR(254) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  -- new | contacted | archived
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  submission_count INTEGER NOT NULL DEFAULT 1,
  anonymous_id TEXT,
  first_submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_website_email_uq ON contacts (website_id, email);
CREATE INDEX IF NOT EXISTS ix_contacts_website_last_submitted ON contacts (website_id, last_submitted_at DESC);
CREATE INDEX IF NOT EXISTS ix_contacts_website_status ON contacts (website_id, status);

CREATE TABLE IF NOT EXISTS lead_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  automation_id UUID,
  variant VARCHAR(64),
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_url TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_lead_submissions_contact_created ON lead_submissions (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_lead_submissions_website_automation ON lead_submissions (website_id, automation_id);
