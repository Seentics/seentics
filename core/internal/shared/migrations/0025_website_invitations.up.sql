CREATE TABLE IF NOT EXISTS website_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(website_id, email)
);

CREATE INDEX idx_website_invitations_token ON website_invitations(token);
CREATE INDEX idx_website_invitations_website_id ON website_invitations(website_id);
CREATE INDEX idx_website_invitations_email ON website_invitations(email);
