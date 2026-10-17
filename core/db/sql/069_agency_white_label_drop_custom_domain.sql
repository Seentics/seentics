-- The agency custom domain moved to the gateway (it provisions the hostname and its
-- certificate at the edge), so Core's white-label row no longer stores one.

ALTER TABLE agency_white_label DROP COLUMN IF EXISTS custom_domain;
