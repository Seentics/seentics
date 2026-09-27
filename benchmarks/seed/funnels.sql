-- Funnels for one bench site: three funnel definitions and the tracker's funnel events
-- for them, derived from the site's already-seeded sessions. Rerunnable — it replaces
-- the site's bench funnels and funnel events.
--
--   psql -v site=<website uuid> < funnels.sql
--
-- Each funnel is entered by 5% of sessions and loses visitors at every step the way a
-- real signup flow does (60% → 30% → 15% reach steps 1–3, 12% complete). Three funnels
-- rather than one, so the report's filter on funnel_id is doing real work. The draw is
-- a hash of the session and funnel, so reruns produce the same events.

DELETE FROM analytics_events
WHERE website_id = :'site' AND event_type IN ('funnel_step', 'funnel_complete');
DELETE FROM funnels WHERE website_id = :'site'::uuid AND name LIKE 'bench:%';

INSERT INTO funnels (website_id, user_id, name, steps)
SELECT w.id, w.user_id, 'bench: ' || f.name, jsonb_build_array(
  jsonb_build_object('id', 's0', 'name', 'Pricing',    'order', 0, 'step_type', 'page', 'page_path', '/pricing',    'match_type', 'exact'),
  jsonb_build_object('id', 's1', 'name', 'Signup',     'order', 1, 'step_type', 'page', 'page_path', '/signup',     'match_type', 'exact'),
  jsonb_build_object('id', 's2', 'name', 'Onboarding', 'order', 2, 'step_type', 'page', 'page_path', '/onboarding', 'match_type', 'exact'),
  jsonb_build_object('id', 's3', 'name', 'Activated',  'order', 3, 'step_type', 'event', 'event_type', 'activated', 'match_type', 'exact'))
FROM websites w, (VALUES ('checkout'), ('onboarding'), ('trial')) AS f(name)
WHERE w.id = :'site'::uuid;

CREATE TEMP TABLE bench_funnel_sessions AS
SELECT session_id, min(visitor_id) AS visitor_id, min(occurred_at) AS started_at
FROM analytics_events
WHERE website_id = :'site' AND event_type = 'pageview' AND session_id IS NOT NULL
GROUP BY session_id;

CREATE TEMP TABLE bench_funnel_entries AS
SELECT s.*, f.id AS funnel_id,
       (abs(hashtext(s.session_id || f.id::text)) % 1000000) / 1000000.0 AS r
FROM bench_funnel_sessions s
CROSS JOIN funnels f
WHERE f.website_id = :'site'::uuid AND f.name LIKE 'bench:%'
  AND (abs(hashtext(f.id::text || s.session_id)) % 100) < 5;

-- Step 0 for every entry, then each later step while the draw keeps the visitor in.
INSERT INTO analytics_events (website_id, event_type, visitor_id, session_id, properties, occurred_at)
SELECT :'site', 'funnel_step', e.visitor_id, e.session_id,
       jsonb_build_object('funnel_id', e.funnel_id::text, 'step', st.step),
       e.started_at + (st.step * 40 || ' seconds')::interval
FROM bench_funnel_entries e
CROSS JOIN generate_series(0, 3) AS st(step)
WHERE st.step = 0 OR e.r < (ARRAY[0.60, 0.30, 0.15])[st.step];

INSERT INTO analytics_events (website_id, event_type, visitor_id, session_id, properties, occurred_at)
SELECT :'site', 'funnel_complete', e.visitor_id, e.session_id,
       jsonb_build_object('funnel_id', e.funnel_id::text),
       e.started_at + interval '170 seconds'
FROM bench_funnel_entries e
WHERE e.r < 0.12;

SELECT event_type, count(*) FROM analytics_events
WHERE website_id = :'site' AND event_type IN ('funnel_step', 'funnel_complete')
GROUP BY 1 ORDER BY 1;
