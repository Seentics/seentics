-- Where a contact first came from, stored: the channel (the dashboard's traffic channels: paid,
-- social, organic…) and the UTM campaign of the page they first submitted on. Set when the contact
-- is created from a submission, so the contacts list can be filtered by them; read back instead of
-- reclassifying on every view.
--
-- Existing contacts: the campaign comes straight from the stored first page URL; the channel needs
-- the analytics module's rules, which SQL cannot run, so it stays empty and the dashboard still
-- works it out on view. There are no production customers yet, so no further backfill is needed.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_channel TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_campaign TEXT;

UPDATE contacts
SET first_campaign = NULLIF(substring(first_page_url FROM '[?&]utm_campaign=([^&#]*)'), '')
WHERE first_campaign IS NULL AND first_page_url LIKE '%utm_campaign=%';

CREATE INDEX IF NOT EXISTS ix_contacts_website_first_channel ON contacts (website_id, first_channel);
CREATE INDEX IF NOT EXISTS ix_contacts_website_first_campaign ON contacts (website_id, first_campaign);
