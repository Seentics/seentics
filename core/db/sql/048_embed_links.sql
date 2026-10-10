-- Permanent, revocable embed links.
--
-- A link lets a developer show one website's analytics (or all of a client's) in an
-- iframe in their own app. The row is the link's identity: the token the URL carries is
-- signed from the row's id and is never stored, so it can be shown again whenever the
-- owner opens the page. Verifying a token checks the signature and that this row exists
-- and has not been revoked.
--
-- A target has at most one live link. Revoking sets revoked_at and keeps the row; making
-- the link again inserts a new row, so the old URL stays dead.
--
-- Unlike the older agency tables these reference their targets, so deleting a website or
-- a client takes its links with it.

CREATE TABLE IF NOT EXISTS embed_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT ck_embed_links_one_target CHECK ((website_id IS NULL) <> (client_id IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_embed_links_owner_id ON embed_links (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_embed_links_website_live
  ON embed_links (website_id) WHERE website_id IS NOT NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_embed_links_client_live
  ON embed_links (client_id) WHERE client_id IS NOT NULL AND revoked_at IS NULL;
