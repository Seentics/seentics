-- =============================================================================
-- Realistic analytics history for one website, for dashboard correctness and
-- performance testing. Run through psql with variables:
--
--   -v site=<website uuid> -v host=<https://example.test> -v sessions=<n> -v seed=<0..1>
--
-- Deterministic for a given seed. Models sessions, because that is what the
-- dashboard's metrics are made of: bounce rate, duration, entry/exit pages and
-- first-touch source all need events that belong together.
--
--   - visitors return: a pool of 0.6 × sessions visitor ids, skewed so a few
--     return often and most come once;
--   - the landing pageview carries the external referrer and any UTM tags; every
--     later pageview's referrer is the previous page on the same site, as a real
--     browser sends it (tests that internal referrers are not counted as sources);
--   - page popularity is heavy-headed over 200 paths;
--   - country/city, browser/os/device, language and screen are fixed per session;
--   - 90 days of history, weighted toward daytime hours;
--   - ~0.5 clicks per pageview, 3% of sessions sign up, 1% purchase (with revenue).
-- =============================================================================

-- Re-seeding replaces the site's history rather than adding to it.
DELETE FROM analytics_events WHERE website_id = :'site';

SELECT setseed(:seed);

-- Monthly partitions for the history window (the stack only creates current and
-- future months, so older rows would otherwise land in the default partition).
DO $$
DECLARE m date;
BEGIN
  FOR m IN SELECT generate_series(date_trunc('month', now() - interval '100 days'), date_trunc('month', now()), interval '1 month')::date LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events FOR VALUES FROM (%L) TO (%L)',
      'analytics_events_' || to_char(m, 'YYYY_MM'), m, (m + interval '1 month')::date);
  END LOOP;
END $$;

DROP TABLE IF EXISTS seed_sessions;
CREATE TEMP TABLE seed_sessions AS
WITH r AS (
  SELECT g AS n, random() AS r_vis, random() AS r_day, random() AS r_hour, random() AS r_min,
         random() AS r_ch, random() AS r_geo, random() AS r_ua, random() AS r_dev,
         random() AS r_pv, random() AS r_goal, random() AS r_lang
  FROM generate_series(1, :sessions) g
)
SELECT
  n,
  'v' || md5(:'site' || floor(power(r_vis, 1.6) * (:sessions * 0.6))::int)  AS visitor_id,
  's' || md5(:'site' || n)                                                  AS session_id,
  -- Session start: any of the last 90 days, 85% between 07:00 and 23:00 UTC. Capped
  -- 40 minutes before now so a whole session (up to 12 pageviews × 120 s, then a
  -- purchase) still ends in the past — ingest clamps client timestamps, so real data
  -- never runs into the future, and windows that end at "now" would disagree otherwise.
  least(now() - interval '40 minutes',
    date_trunc('day', now()) - (floor(r_day * 90) || ' days')::interval
      + ((CASE WHEN r_hour < 0.85 THEN 7 + floor(r_hour / 0.85 * 16) ELSE floor((r_hour - 0.85) / 0.15 * 24) END) || ' hours')::interval
      + (floor(r_min * 3600) || ' seconds')::interval)                      AS started_at,
  CASE
    WHEN r_ch < 0.30 THEN 'direct'
    WHEN r_ch < 0.58 THEN 'google'
    WHEN r_ch < 0.61 THEN 'bing'
    WHEN r_ch < 0.63 THEN 'duckduckgo'
    WHEN r_ch < 0.71 THEN 'facebook'
    WHEN r_ch < 0.74 THEN 'x'
    WHEN r_ch < 0.76 THEN 'linkedin'
    WHEN r_ch < 0.78 THEN 'reddit'
    WHEN r_ch < 0.83 THEN 'newsletter'
    WHEN r_ch < 0.88 THEN 'cpc'
    WHEN r_ch < 0.92 THEN 'hn'
    WHEN r_ch < 0.95 THEN 'producthunt'
    WHEN r_ch < 0.97 THEN 'partner-campaign'
    ELSE 'blog'
  END AS src,
  CASE
    WHEN r_geo < 0.34 THEN 'US' WHEN r_geo < 0.44 THEN 'DE' WHEN r_geo < 0.52 THEN 'GB'
    WHEN r_geo < 0.60 THEN 'IN' WHEN r_geo < 0.65 THEN 'BD' WHEN r_geo < 0.70 THEN 'FR'
    WHEN r_geo < 0.75 THEN 'CA' WHEN r_geo < 0.79 THEN 'BR' WHEN r_geo < 0.83 THEN 'JP'
    WHEN r_geo < 0.86 THEN 'NL' WHEN r_geo < 0.89 THEN 'AU' WHEN r_geo < 0.92 THEN 'ES'
    WHEN r_geo < 0.96 THEN NULL  -- unresolved IP
    ELSE 'SE'
  END AS country,
  r_geo,
  CASE WHEN r_dev < 0.55 THEN 'Desktop' WHEN r_dev < 0.95 THEN 'Mobile' ELSE 'Tablet' END AS device,
  r_ua, r_dev, r_lang,
  -- Pageviews per session: 45% bounce, long tail to 12.
  CASE WHEN r_pv < 0.45 THEN 1 WHEN r_pv < 0.65 THEN 2 WHEN r_pv < 0.78 THEN 3
       WHEN r_pv < 0.87 THEN 4 WHEN r_pv < 0.93 THEN 5 ELSE 6 + floor((r_pv - 0.93) / 0.07 * 7)::int END AS pageviews,
  r_goal
FROM r;

-- Per-session browser/os/city/language/screen, derived once.
ALTER TABLE seed_sessions
  ADD COLUMN browser text, ADD COLUMN os text, ADD COLUMN city text, ADD COLUMN region text,
  ADD COLUMN language text, ADD COLUMN sw int, ADD COLUMN sh int,
  ADD COLUMN referrer text, ADD COLUMN utm_source text, ADD COLUMN utm_medium text, ADD COLUMN utm_campaign text;

UPDATE seed_sessions SET
  browser = CASE
    WHEN device = 'Desktop' THEN (ARRAY['Chrome 128.0','Chrome 127.0','Firefox 130.0','Safari 17.6','Edge 128.0'])[1 + floor(r_ua * 5)::int]
    ELSE (ARRAY['Chrome 128.0','Safari 17.6','Safari 17.5','Samsung Internet 25.0'])[1 + floor(r_ua * 4)::int] END,
  os = CASE
    WHEN device = 'Desktop' THEN (ARRAY['Windows 10','Windows 11','macOS 14.6','macOS 13.6','Linux'])[1 + floor(r_dev / 0.55 * 5)::int]
    WHEN device = 'Tablet' THEN 'iPadOS 17.6'
    ELSE (ARRAY['Android 14','iOS 17.6','Android 13','iOS 17.5'])[1 + floor((r_dev - 0.55) / 0.40 * 4)::int] END,
  city = CASE country
    WHEN 'US' THEN (ARRAY['New York','San Francisco','Austin','Chicago'])[1 + floor(r_ua * 4)::int]
    WHEN 'DE' THEN (ARRAY['Berlin','Munich'])[1 + floor(r_ua * 2)::int]
    WHEN 'GB' THEN 'London' WHEN 'IN' THEN (ARRAY['Bengaluru','Mumbai'])[1 + floor(r_ua * 2)::int]
    WHEN 'BD' THEN 'Dhaka' WHEN 'FR' THEN 'Paris' WHEN 'CA' THEN 'Toronto' WHEN 'BR' THEN 'São Paulo'
    WHEN 'JP' THEN 'Tokyo' WHEN 'NL' THEN 'Amsterdam' WHEN 'AU' THEN 'Sydney' WHEN 'ES' THEN 'Madrid'
    WHEN 'SE' THEN 'Stockholm' ELSE NULL END,
  language = (ARRAY['en-US','en-GB','de-DE','fr-FR','es-ES','ja-JP','bn-BD','pt-BR'])[1 + floor(r_lang * 8)::int],
  sw = CASE device WHEN 'Desktop' THEN 1920 WHEN 'Tablet' THEN 820 ELSE 390 END,
  sh = CASE device WHEN 'Desktop' THEN 1080 WHEN 'Tablet' THEN 1180 ELSE 844 END,
  referrer = CASE src
    WHEN 'direct' THEN NULL WHEN 'google' THEN 'https://www.google.com/'
    WHEN 'bing' THEN 'https://www.bing.com/' WHEN 'duckduckgo' THEN 'https://duckduckgo.com/'
    WHEN 'facebook' THEN 'https://m.facebook.com/' WHEN 'x' THEN 'https://t.co/abc123'
    WHEN 'linkedin' THEN 'https://www.linkedin.com/feed/' WHEN 'reddit' THEN 'https://www.reddit.com/r/webdev/'
    WHEN 'newsletter' THEN NULL WHEN 'cpc' THEN 'https://www.google.com/'
    WHEN 'hn' THEN 'https://news.ycombinator.com/' WHEN 'producthunt' THEN 'https://www.producthunt.com/'
    WHEN 'partner-campaign' THEN 'https://partner.example.com/deals' ELSE 'https://blog.example.org/review' END,
  utm_source = CASE src WHEN 'newsletter' THEN 'email' WHEN 'cpc' THEN 'google' WHEN 'partner-campaign' THEN 'partner' ELSE NULL END,
  utm_medium = CASE src WHEN 'newsletter' THEN 'email' WHEN 'cpc' THEN 'cpc' WHEN 'partner-campaign' THEN 'affiliate' ELSE NULL END,
  utm_campaign = CASE src WHEN 'newsletter' THEN 'sept-digest' WHEN 'cpc' THEN 'brand-search' WHEN 'partner-campaign' THEN 'autumn-deal' ELSE NULL END;
UPDATE seed_sessions SET region = city WHERE city IS NOT NULL;

-- One row per pageview, with its position in the session and a heavy-headed page.
DROP TABLE IF EXISTS seed_pageviews;
CREATE TEMP TABLE seed_pageviews AS
SELECT s.*, k,
       CASE WHEN floor(power(random(), 3) * 200)::int = 0 THEN '/'
            ELSE (ARRAY['/pricing','/docs','/features','/blog','/signup','/about','/contact','/changelog'])[1 + (floor(power(random(), 2) * 8))::int]
                 || CASE WHEN random() < 0.4 THEN '/' || floor(power(random(), 2) * 25)::int ELSE '' END
       END AS path,
       s.started_at + ((k - 1) * (20 + floor(random() * 100)) || ' seconds')::interval AS at
FROM seed_sessions s, generate_series(1, s.pageviews) k;

-- Pageviews. Landing page: external referrer + UTM tags. Later pages: the previous
-- page on this site as referrer, no UTM — what a browser actually sends.
INSERT INTO analytics_events
  (website_id, event_type, page, visitor_id, session_id, properties, referrer, country, region, city,
   browser, device, os, language, screen_width, screen_height, utm_source, utm_medium, utm_campaign, channel, occurred_at)
SELECT
  :'site', 'pageview', :'host' || path, visitor_id, session_id, '{}'::jsonb, referrer,
  country, region, city, browser, device, os, language, sw, sh,
  utm_source, utm_medium, utm_campaign,
  -- Channel as ingest stores it: a frozen copy of CHANNEL_CASE_SQL (see 029),
  -- computed here rather than by a later UPDATE that would rewrite every row.
  CASE
    WHEN lower(coalesce(utm_medium, '')) IN ('cpc', 'ppc', 'paid', 'paid_social', 'paidsearch', 'paid_search', 'sem')
      OR lower(coalesce(utm_medium, '')) LIKE 'paid%' THEN 'paid'
    WHEN utm_medium = 'email' OR utm_source = 'email' THEN 'email'
    WHEN utm_medium = 'social'
      OR utm_source IN ('facebook', 'twitter', 'x', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit')
      OR (referrer IS NOT NULL AND referrer ~* '^https?://([^/]*\.)?(facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|pinterest\.com|reddit\.com|t\.co|youtube\.com|tiktok\.com|snapchat\.com)([/:?#]|$)') THEN 'social'
    WHEN referrer IS NOT NULL AND referrer ~* '^https?://([^/]*\.)?(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave)\.' THEN 'organic'
    WHEN utm_source IS NOT NULL AND length(trim(utm_source)) > 0 THEN 'campaign'
    WHEN lower(regexp_replace(substring(referrer from '^https?://([^/?#:]+)'), '^www\.', '', 'i'))
       = lower(regexp_replace(substring(:'host' || path from '^https?://([^/?#:]+)'), '^www\.', '', 'i')) THEN 'internal'
    WHEN referrer IS NOT NULL AND length(trim(referrer)) > 0 THEN 'referral'
    ELSE 'direct'
  END,
  at
FROM (
  SELECT p.*,
    CASE WHEN k = 1 THEN p.referrer ELSE :'host' || lag(path) OVER (PARTITION BY session_id ORDER BY k) END AS ref,
    CASE WHEN k = 1 THEN p.utm_source END AS utm_s, CASE WHEN k = 1 THEN p.utm_medium END AS utm_m,
    CASE WHEN k = 1 THEN p.utm_campaign END AS utm_c
  FROM seed_pageviews p
) pv(n, visitor_id, session_id, started_at, src, country, r_geo, device, r_ua, r_dev, r_lang, pageviews, r_goal,
     browser, os, city, region, language, sw, sh, referrer_landing, utm_source_landing, utm_medium_landing, utm_campaign_landing,
     k, path, at, referrer, utm_source, utm_medium, utm_campaign);

-- Clicks (~0.5 per pageview): non-pageview traffic every dashboard query must ignore.
INSERT INTO analytics_events
  (website_id, event_type, page, visitor_id, session_id, properties, country, browser, device, os, occurred_at)
SELECT :'site', 'click', :'host' || path, visitor_id, session_id, '{"target":"button#cta"}'::jsonb,
       country, browser, device, os, at + interval '5 seconds'
FROM seed_pageviews WHERE random() < 0.5;

-- Signups (3% of sessions) and purchases (1%), at the end of the session.
INSERT INTO analytics_events
  (website_id, event_type, page, visitor_id, session_id, properties, country, browser, device, os, referrer, occurred_at)
SELECT :'site', CASE WHEN r_goal < 0.01 THEN 'purchase' ELSE 'signup' END,
       :'host' || '/signup', visitor_id, session_id,
       CASE WHEN r_goal < 0.01
         THEN jsonb_build_object('name', 'purchase', 'revenue', (19 + floor(r_goal * 100 * 80))::int, 'currency', 'USD')
         ELSE jsonb_build_object('name', 'signup') END,
       country, browser, device, os, referrer,
       started_at + (pageviews * 90 || ' seconds')::interval
FROM seed_sessions WHERE r_goal < 0.04;

ANALYZE analytics_events;
SELECT event_type, count(*) FROM analytics_events WHERE website_id = :'site' GROUP BY 1 ORDER BY 2 DESC;
