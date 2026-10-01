-- A third consent mode, `none`: no consent asked, everything collected — for a site
-- outside the GDPR's reach or with another legal basis, on its owner's judgement. The
-- default stays `cookieless`, which now means anonymous until the visitor consents.

ALTER TABLE website_privacy_settings DROP CONSTRAINT IF EXISTS chk_consent_mode;
ALTER TABLE website_privacy_settings
  ADD CONSTRAINT chk_consent_mode CHECK (consent_mode IN ('cookieless', 'strict', 'none'));
