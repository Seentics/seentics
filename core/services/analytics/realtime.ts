import { sql as pgSql } from "../../db";
import { resolveSiteId } from "./shared";

/** Rolling window for `/analytics/realtime` (matches dashboard “last ~30 minutes”). */
export const REALTIME_WINDOW_MS = 30 * 60_000;

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
 * All headline numbers are **pageview-scoped** so “active” visitors align with pageviews/sessions.
 */
export async function getRealtimeStats(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  const since = new Date(Date.now() - REALTIME_WINDOW_MS);
  const sinceIso = since.toISOString();

  const [
    pageviewsRow,
    sessionsRow,
    visitorsRow,
    activePages,
    topCountriesRows,
    topReferrersRows,
    topDevicesRows,
    topBrowsersRows,
    timelineRows,
  ] = await Promise.all([
    pgSql<{ c: number }[]>`
      SELECT count(*)::int AS c
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
    `,
    pgSql<{ c: number }[]>`
      SELECT count(DISTINCT session_id)::int AS c
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    `,
    pgSql<{ c: number }[]>`
      SELECT count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS c
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
    `,
    pgSql<{ page: string; visitors: number }[]>`
      SELECT
        page,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
        AND page IS NOT NULL
        AND length(trim(page)) > 0
      GROUP BY page
      ORDER BY visitors DESC
      LIMIT 10
    `,
    pgSql<{ name: string; visitors: number }[]>`
      SELECT
        coalesce(nullif(trim(country), ''), '') AS name,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
      GROUP BY 1
      ORDER BY visitors DESC
      LIMIT 10
    `,
    pgSql<{ name: string; visitors: number }[]>`
      SELECT
        coalesce(
          nullif(
            substring(regexp_replace(trim(referrer), '^https?://', '', 'i') from '^([^/]+)'),
            ''
          ),
          '(direct)'
        ) AS name,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
        AND referrer IS NOT NULL
        AND length(trim(referrer)) > 0
      GROUP BY 1
      ORDER BY visitors DESC
      LIMIT 10
    `,
    pgSql<{ name: string; visitors: number }[]>`
      SELECT
        coalesce(nullif(trim(device), ''), 'Unknown') AS name,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
      GROUP BY 1
      ORDER BY visitors DESC
      LIMIT 10
    `,
    pgSql<{ name: string; visitors: number }[]>`
      SELECT
        coalesce(nullif(trim(browser), ''), 'Unknown') AS name,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
      GROUP BY 1
      ORDER BY visitors DESC
      LIMIT 10
    `,
    pgSql<{ minute: string; views: number; visitors: number }[]>`
      SELECT
        to_char(grp_at, 'HH24:MI') AS minute,
        count(*)::int AS views,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM (
        SELECT
          date_trunc('minute', occurred_at AT TIME ZONE 'UTC') AS grp_at,
          visitor_id,
          session_id
        FROM analytics_events
        WHERE website_id = ${siteId}
          AND event_type = 'pageview'
          AND occurred_at >= ${sinceIso}
      ) bucketed
      GROUP BY grp_at
      ORDER BY grp_at
    `,
  ]);

  const pageviews = Number(pageviewsRow[0]?.c ?? 0);
  const sessions = Number(sessionsRow[0]?.c ?? 0);
  const liveCount = Number(visitorsRow[0]?.c ?? 0);

  const top_pages = activePages.map((p) => {
    const v = Number(p.visitors);
    return { page: p.page, visitors: v, count: v };
  });
  const top_countries = topCountriesRows.map((r) => ({
    name: r.name || "Unknown",
    visitors: Number(r.visitors),
    country: r.name || "Unknown",
    count: Number(r.visitors),
  }));
  const top_referrers = topReferrersRows.map((r) => ({
    name: r.name || "(direct)",
    visitors: Number(r.visitors),
  }));
  const top_devices = topDevicesRows.map((r) => ({
    name: r.name || "Unknown",
    visitors: Number(r.visitors),
  }));
  const top_browsers = topBrowsersRows.map((r) => ({
    name: r.name || "Unknown",
    visitors: Number(r.visitors),
  }));

  const timeline = buildUtcTimeline(timelineRows);

  return {
    website_id: siteId,
    active_visitors: liveCount,
    live_visitors: liveCount,
    pageviews,
    sessions,
    top_pages,
    top_countries,
    top_referrers,
    top_devices,
    top_browsers,
    timeline,
    /** Legacy field name still returned by older clients; same as `top_pages`. */
    pages: activePages.map((p) => ({ page: p.page, visitors: Number(p.visitors) })),
  };
}
