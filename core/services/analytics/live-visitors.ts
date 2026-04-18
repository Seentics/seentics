import { sql as pgSql } from "../../db";
import { resolveSiteId } from "./shared";
import { getRealtimeStats, REALTIME_WINDOW_MS } from "./realtime";

export async function getLiveVisitorsStats(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  const since = new Date(Date.now() - REALTIME_WINDOW_MS);
  const sinceIso = since.toISOString();

  const [realtimeOut, recentVisitors] = await Promise.all([
    getRealtimeStats(websiteParam),
    pgSql<{
      visitor_id: string;
      session_id: string;
      page: string;
      country: string | null;
      browser: string | null;
      device: string | null;
      occurred_at: string;
    }[]>`
      SELECT DISTINCT ON (coalesce(nullif(trim(visitor_id), ''), session_id))
        coalesce(nullif(trim(visitor_id), ''), session_id) AS visitor_id,
        session_id,
        page,
        country,
        browser,
        device,
        occurred_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
        AND session_id IS NOT NULL
      ORDER BY coalesce(nullif(trim(visitor_id), ''), session_id), occurred_at DESC
      LIMIT 25
    `,
  ]);

  return {
    website_id: realtimeOut.website_id,
    live_visitors: realtimeOut.live_visitors,
    active_visitors: realtimeOut.active_visitors,
    visitors: recentVisitors.map((v) => ({
      visitor_id: v.visitor_id,
      session_id: v.session_id,
      page: v.page,
      country: v.country ?? null,
      browser: v.browser ?? null,
      device: v.device ?? null,
      last_seen: v.occurred_at,
    })),
  };
}
