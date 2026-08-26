import { sql as pgSql } from "../../../db";
import { LIVE_VISITOR_WINDOW_MS, REALTIME_WINDOW_MS } from "./realtime.repository";

export async function getLiveVisitorsStats(siteId: string) {
  // live = pageview in the last 30 seconds; active = last 30 minutes.
  const liveSinceIso = new Date(Date.now() - LIVE_VISITOR_WINDOW_MS).toISOString();
  const activeSinceIso = new Date(Date.now() - REALTIME_WINDOW_MS).toISOString();

  const [countRows, recentVisitors] = await Promise.all([
    pgSql<{ live_visitors: number; active_visitors: number }[]>`
      SELECT
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))
          FILTER (WHERE occurred_at >= ${liveSinceIso})::int AS live_visitors,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS active_visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${activeSinceIso}
    `,
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
        AND occurred_at >= ${liveSinceIso}
        AND session_id IS NOT NULL
      ORDER BY coalesce(nullif(trim(visitor_id), ''), session_id), occurred_at DESC
      LIMIT 25
    `,
  ]);

  return {
    website_id: siteId,
    live_visitors: Number(countRows[0]?.live_visitors ?? 0),
    active_visitors: Number(countRows[0]?.active_visitors ?? 0),
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
