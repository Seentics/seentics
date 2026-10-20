-- What kind of business a website is for, so the dashboard can put that business's pages first
-- (web: features/sidebar/profiles.ts). Null until chosen or inferred: the sidebar then shows the
-- full list in its usual order. Only the order and the "More" group change; no page is gated.

ALTER TABLE websites ADD COLUMN IF NOT EXISTS profile TEXT
  CHECK (profile IN ('fcommerce', 'store', 'leads', 'other'));
