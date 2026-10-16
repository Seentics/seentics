-- Server-side conversions to TikTok's Events API and LinkedIn's Conversions API, alongside
-- Meta and GA4. Only the platform check changes: the rows, the outbox and the worker are shared.

ALTER TABLE conversion_destinations DROP CONSTRAINT IF EXISTS conversion_destinations_platform_check;
ALTER TABLE conversion_destinations
  ADD CONSTRAINT conversion_destinations_platform_check CHECK (platform IN ('meta', 'ga4', 'tiktok', 'linkedin'));
