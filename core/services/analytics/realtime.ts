import { sql as pgSql } from "../../db";
import { resolveSiteId } from "./shared";

/** Rolling window for `/analytics/realtime` (matches dashboard "last ~30 minutes"). */
export const REALTIME_WINDOW_MS = 30 * 60_000;

/** Window for "Live Visitors" badge — people with a pageview in the last 30 seconds. */
export const LIVE_VISITOR_WINDOW_MS = 30_000;

function utcMinuteKey(d: Date): string {
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
}

function buildUtcTimeline(
  rows: { minute: string; views: number; visitors: number }[],
): { minute: string; views: number; visitors: number }[] {
  const map = new Map(rows.map((r) => [r.minute, r]));
  const out: { minute: string; views: number; visitors: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 60_000);
    const key = utcMinuteKey(d);
    const hit = map.get(key);
    out.push({ minute: key, views: hit?.views ?? 0, visitors: hit?.visitors ?? 0 });
  }
  return out;
}

/**
 * Live stats for the last {@link REALTIME_WINDOW_MS}.
 * Single CTE query — one table scan instead of 9 round trips.
 */
export async function getRealtimeStats(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  const since = new Date(Date.now() - REALTIME_WINDOW_MS);
  const sinceIso = since.toISOString();

  // One query: materialize base rows once, derive all aggregates via CTEs.
  const rows = await pgSql<{
    pageviews: number;
    sessions: number;
    visitors: number;
    top_pages: { page: string; visitors: number }[] | null;
    top_countries: { name: string; visitors: number }[] | null;
    top_referrers: { name: string; visitors: number }[] | null;
    top_devices: { name: string; visitors: number }[] | null;
    top_browsers: { name: string; visitors: number }[] | null;
    timeline: { minute: string; views: number; visitors: number }[] | null;
  }[]>`
    WITH base AS (
      SELECT
        page,
        country,
        referrer,
        device,
        browser,
        visitor_id,
        session_id,
        date_trunc('minute', occurred_at AT TIME ZONE 'UTC') AS grp_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
    ),
    counts AS (
      SELECT
        count(*)::int AS pageviews,
        count(DISTINCT CASE WHEN session_id IS NOT NULL AND length(trim(session_id)) > 0
                            THEN session_id END)::int AS sessions,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM base
    ),
    pages_agg AS (
      SELECT json_agg(t ORDER BY t.visitors DESC) AS data
      FROM (
        SELECT page,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
        FROM base
        WHERE page IS NOT NULL AND length(trim(page)) > 0
        GROUP BY page ORDER BY visitors DESC LIMIT 10
      ) t
    ),
    countries_agg AS (
      SELECT json_agg(t ORDER BY t.visitors DESC) AS data
      FROM (
        SELECT coalesce(nullif(trim(country), ''), 'Unknown') AS name,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
        FROM base GROUP BY 1 ORDER BY visitors DESC LIMIT 10
      ) t
    ),
    referrers_agg AS (
      SELECT json_agg(t ORDER BY t.visitors DESC) AS data
      FROM (
        SELECT coalesce(
                 nullif(substring(regexp_replace(trim(referrer), '^https?://', '', 'i') from '^([^/]+)'), ''),
                 '(direct)'
               ) AS name,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
        FROM base
        WHERE referrer IS NOT NULL AND length(trim(referrer)) > 0
        GROUP BY 1 ORDER BY visitors DESC LIMIT 10
      ) t
    ),
    devices_agg AS (
      SELECT json_agg(t ORDER BY t.visitors DESC) AS data
      FROM (
        SELECT coalesce(nullif(trim(device), ''), 'Unknown') AS name,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
        FROM base GROUP BY 1 ORDER BY visitors DESC LIMIT 10
      ) t
    ),
    browsers_agg AS (
      SELECT json_agg(t ORDER BY t.visitors DESC) AS data
      FROM (
        SELECT coalesce(nullif(trim(browser), ''), 'Unknown') AS name,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
        FROM base GROUP BY 1 ORDER BY visitors DESC LIMIT 10
      ) t
    ),
    timeline_agg AS (
      SELECT json_agg(t ORDER BY t.grp_at) AS data
      FROM (
        SELECT to_char(grp_at, 'HH24:MI') AS minute,
               count(*)::int AS views,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors,
               grp_at
        FROM base GROUP BY grp_at ORDER BY grp_at
      ) t
    )
    SELECT
      c.pageviews,
      c.sessions,
      c.visitors,
      p.data  AS top_pages,
      cn.data AS top_countries,
      r.data  AS top_referrers,
      d.data  AS top_devices,
      b.data  AS top_browsers,
      tl.data AS timeline
    FROM counts c, pages_agg p, countries_agg cn, referrers_agg r,
         devices_agg d, browsers_agg b, timeline_agg tl
  `;

  const row = rows[0];
  const pageviews = Number(row?.pageviews ?? 0);
  const sessions  = Number(row?.sessions  ?? 0);
  const liveCount = Number(row?.visitors  ?? 0);

  const top_pages     = (row?.top_pages     ?? []).map((p) => ({ page: p.page, visitors: Number(p.visitors), count: Number(p.visitors) }));
  const top_countries = (row?.top_countries ?? []).map((r) => ({ name: r.name || "Unknown", visitors: Number(r.visitors), country: r.name || "Unknown", count: Number(r.visitors) }));
  const top_referrers = (row?.top_referrers ?? []).map((r) => ({ name: r.name || "(direct)", visitors: Number(r.visitors) }));
  const top_devices   = (row?.top_devices   ?? []).map((r) => ({ name: r.name || "Unknown", visitors: Number(r.visitors) }));
  const top_browsers  = (row?.top_browsers  ?? []).map((r) => ({ name: r.name || "Unknown", visitors: Number(r.visitors) }));

  const timeline = buildUtcTimeline(
    (row?.timeline ?? []).map((t) => ({ minute: t.minute, views: Number(t.views), visitors: Number(t.visitors) })),
  );

  return {
    website_id: siteId,
    active_visitors: liveCount,
    live_visitors:   liveCount,
    pageviews,
    sessions,
    top_pages,
    top_countries,
    top_referrers,
    top_devices,
    top_browsers,
    timeline,
    pages: top_pages.map((p) => ({ page: p.page, visitors: p.visitors })),
  };
}
