-- Contacts: the people behind a website's form submissions, kept until the owner deletes them.
--
-- A submission is an event, aged out after 90 days (leads retention). A contact is the person:
-- one row per website and email, created by their first submission (source 'form') or by the
-- owner, by hand ('manual') or from a CSV ('import'). It carries what the owner manages —
-- status, tags, notes — and where the person first came from. Their submissions are found by
-- email, not by a foreign key, so a submission ageing out never touches the contact and a
-- contact deleted without its submissions leaves those to age out on their own.

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  -- Trimmed and lower-cased, as submissions store it.
  email VARCHAR(254) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'customer', 'lost')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  source VARCHAR(8) NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'manual', 'import')),
  -- First touch, from the first submission; empty for contacts added by hand.
  first_page_url TEXT NOT NULL DEFAULT '',
  first_referrer TEXT NOT NULL DEFAULT '',
  -- The latest visitor id the person submitted from, so a visitor's data request finds them.
  anonymous_id TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_website_email ON contacts (website_id, email);
CREATE INDEX IF NOT EXISTS ix_contacts_website_activity ON contacts (website_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS ix_contacts_website_created ON contacts (website_id, created_at DESC);
-- Submissions are joined to contacts by email.
CREATE INDEX IF NOT EXISTS ix_form_submissions_website_email ON form_submissions (website_id, email);

-- Everyone who has submitted so far becomes a contact: first touch from their first
-- submission, name and phone from their latest one that gave them.
INSERT INTO contacts (website_id, email, name, phone, source, first_page_url, first_referrer, anonymous_id,
                      first_seen_at, last_activity_at, created_at, updated_at)
SELECT s.website_id, s.email,
       COALESCE((SELECT x.name FROM form_submissions x WHERE x.website_id = s.website_id AND x.email = s.email AND x.name <> '' ORDER BY x.created_at DESC LIMIT 1), ''),
       COALESCE((SELECT x.phone FROM form_submissions x WHERE x.website_id = s.website_id AND x.email = s.email AND x.phone <> '' ORDER BY x.created_at DESC LIMIT 1), ''),
       'form',
       first.page_url, first.referrer,
       (SELECT x.anonymous_id FROM form_submissions x WHERE x.website_id = s.website_id AND x.email = s.email AND x.anonymous_id IS NOT NULL ORDER BY x.created_at DESC LIMIT 1),
       s.first_at, s.last_at, s.first_at, NOW()
FROM (
  SELECT website_id, email, MIN(created_at) AS first_at, MAX(created_at) AS last_at
  FROM form_submissions GROUP BY website_id, email
) s
CROSS JOIN LATERAL (
  SELECT x.page_url, x.referrer FROM form_submissions x
  WHERE x.website_id = s.website_id AND x.email = s.email ORDER BY x.created_at ASC LIMIT 1
) first
ON CONFLICT (website_id, email) DO NOTHING;
