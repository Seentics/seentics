-- Rollups: pre-computed daily summaries of the analytics data, so dashboard reads stop
-- scaling with a site's traffic.
--
-- Every dashboard query used to recompute from raw `analytics_events`. Benchmarked on a
-- site with 3.8M events, grouping 30 days of events into sessions alone took ~9 s however
-- the SQL was written, and several 90-day reports hit the statement timeout. These hold
-- the answers instead, and the dashboard reads a few thousand rows at most.
--
-- They are rebuilt one website-day at a time: ingest marks the day stale
-- (`analytics_rollup_stale`), and `modules/analytics/rollups/builder.ts` recomputes
-- exactly that day from raw events. (Postgres's own MATERIALIZED VIEW can only refresh
-- everything at once — every site, all history — which grows forever; that is why these
-- are plain tables.) Raw events stay the source of truth; any day can be rebuilt from
-- them at any time.
--
-- Unique visitors are HyperLogLog sketches (`hll`, log2m 13 / regwidth 5): ~1.2% typical
-- error, exact at small counts, and they union across any set of days. Everything else
-- here is an exact count.

CREATE EXTENSION IF NOT EXISTS hll;

-- Website-days whose rollups are stale. Ingest upserts here in the same transaction as
-- the events it writes; the builder rebuilds the day (and, early in a day, the day
-- before, whose sessions may continue into it) and clears what it covered.
CREATE TABLE IF NOT EXISTS analytics_rollup_stale (
  website_id TEXT NOT NULL,
  day        DATE NOT NULL,
  staled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (website_id, day)
);

-- One row per session, keyed by the UTC day of its first pageview.
--
-- channel / referrer_domain follow the dashboard's session rule: a known source wins over
-- direct, and in-site navigation never sets it (lib/traffic-channel.ts).
CREATE TABLE IF NOT EXISTS analytics_rollup_sessions (
  website_id      TEXT NOT NULL,
  day             DATE NOT NULL,
  session_id      TEXT NOT NULL,
  visitor_key     TEXT,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ NOT NULL,
  pageviews       INT NOT NULL,
  landing_path    TEXT,
  exit_path       TEXT,
  path_seq        TEXT[],
  channel         TEXT NOT NULL,
  referrer_domain TEXT NOT NULL,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  country         TEXT,
  city            TEXT,
  device          TEXT,
  browser         TEXT,
  os              TEXT,
  language        TEXT,
  PRIMARY KEY (website_id, day, session_id)
);
-- Revenue attributes a purchase to its session by id.
CREATE INDEX IF NOT EXISTS ix_analytics_rollup_sessions_session ON analytics_rollup_sessions (website_id, session_id);

-- One row per website, UTC day, dimension and value.
--
--   dimension 'site' (value '')      — pageviews, visitors, and sessions/bounces/duration
--   pageview dimensions              — page, country, city, country_city, device, browser,
--                                      os, language, resolution: pageviews + visitors
--   session dimensions               — channel, referrer, utm_source, utm_medium,
--                                      utm_campaign, entry_page, exit_page, path: pageviews
--                                      of those sessions, sessions, bounces, duration, visitors
--   'event'                          — non-pageview event types: count (in `pageviews`),
--                                      sessions that day, visitors
CREATE TABLE IF NOT EXISTS analytics_rollup_daily (
  website_id TEXT   NOT NULL,
  day        DATE   NOT NULL,
  dimension  TEXT   NOT NULL,
  value      TEXT   NOT NULL,
  pageviews  BIGINT NOT NULL DEFAULT 0,
  sessions   INT    NOT NULL DEFAULT 0,
  bounces    INT    NOT NULL DEFAULT 0,
  duration_s BIGINT NOT NULL DEFAULT 0,
  visitors   hll    NOT NULL,
  PRIMARY KEY (website_id, dimension, day, value)
);

-- Site totals per UTC hour: the hour-of-day chart, and the daily chart in the viewer's
-- time zone (hours regrouped into local days).
CREATE TABLE IF NOT EXISTS analytics_rollup_hourly (
  website_id TEXT        NOT NULL,
  hour       TIMESTAMPTZ NOT NULL,
  pageviews  INT         NOT NULL,
  visitors   hll         NOT NULL,
  PRIMARY KEY (website_id, hour)
);

-- The first day each visitor was seen, for new vs returning.
CREATE TABLE IF NOT EXISTS analytics_rollup_visitor_first_seen (
  website_id  TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  first_day   DATE NOT NULL,
  PRIMARY KEY (website_id, visitor_key)
);
CREATE INDEX IF NOT EXISTS ix_analytics_rollup_visitor_first_seen_day ON analytics_rollup_visitor_first_seen (website_id, first_day);

-- Backfill: every website-day that already has events is stale.
INSERT INTO analytics_rollup_stale (website_id, day)
SELECT DISTINCT website_id, (occurred_at AT TIME ZONE 'UTC')::date
FROM analytics_events
ON CONFLICT DO NOTHING;
