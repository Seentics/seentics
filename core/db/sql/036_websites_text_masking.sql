-- Text masking for session recordings and heatmap snapshots.
--
-- Inputs, editable regions and anything marked data-seentics-mask were always masked;
-- the rest of a page's text was recorded as shown. Pages that show who a visitor is —
-- an account page with their name and address — put that into every recording.
--
-- mask_all_text masks every text node on every page. mask_text_patterns masks every
-- text node on the pages it matches (newline-separated, like the replay and heatmap
-- page lists) and defaults to the pages that usually show personal details.

ALTER TABLE websites ADD COLUMN IF NOT EXISTS mask_all_text BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS mask_text_patterns TEXT
  DEFAULT E'/account\n/profile\n/settings\n/checkout\n/billing\n/orders';
