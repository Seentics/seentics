-- Store each pageview's traffic channel at ingest instead of deriving it on every read.
--
-- traffic-summary classified channels with a CASE running two case-insensitive regexes
-- over every pageview's referrer in the window — ~3.9 s of a 13 s query at 845k
-- pageviews, re-deriving a value that never changes once the event is written. New
-- events now carry `channel` from `classifyTrafficChannel`; this backfills the rest.
--
-- A pageview whose referrer is on the page's own host is `internal`: in-site
-- navigation, which is not a way traffic arrives and must not be counted as referral.
--
-- The CASE below is a frozen copy of `CHANNEL_CASE_SQL` in
-- modules/analytics/lib/traffic-channel.ts as of this migration. Reads still fall back
-- to that expression for any row left NULL, so a missed row is slow, not wrong.

ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS channel VARCHAR(16);

UPDATE analytics_events
SET channel = CASE
  WHEN lower(coalesce(utm_medium, '')) IN ('cpc', 'ppc', 'paid', 'paid_social', 'paidsearch', 'paid_search', 'sem')
    OR lower(coalesce(utm_medium, '')) LIKE 'paid%' THEN 'paid'
  WHEN utm_medium = 'email' OR utm_source = 'email' THEN 'email'
  WHEN utm_medium = 'social'
    OR utm_source IN ('facebook', 'twitter', 'x', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit')
    OR (referrer IS NOT NULL AND referrer ~* '^https?://([^/]*\.)?(facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|pinterest\.com|reddit\.com|t\.co|youtube\.com|tiktok\.com|snapchat\.com)([/:?#]|$)') THEN 'social'
  WHEN referrer IS NOT NULL AND referrer ~* '^https?://([^/]*\.)?(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave)\.' THEN 'organic'
  WHEN utm_source IS NOT NULL AND length(trim(utm_source)) > 0 THEN 'campaign'
  WHEN lower(regexp_replace(substring(referrer from '^https?://([^/?#:]+)'), '^www\.', '', 'i'))
     = lower(regexp_replace(substring(page from '^https?://([^/?#:]+)'), '^www\.', '', 'i')) THEN 'internal'
  WHEN referrer IS NOT NULL AND length(trim(referrer)) > 0 THEN 'referral'
  ELSE 'direct'
END
WHERE event_type = 'pageview' AND channel IS NULL;
