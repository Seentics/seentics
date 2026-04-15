import { and, eq, gte } from "drizzle-orm";
import { analyticsEvents, db, sql as pgSql } from "../../db";
import { countDistinctVisitorsSql, resolveSiteId } from "./shared";

export async function getRealtimeStats(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  const since = new Date(Date.now() - 5 * 60_000);
  const sinceIso = since.toISOString();

  const [visitors, activePages] = await Promise.all([
    db
      .select({ c: countDistinctVisitorsSql() })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.websiteId, siteId), gte(analyticsEvents.occurredAt, since))),
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
  ]);

  const liveCount = Number(visitors[0]?.c ?? 0);
  return {
    website_id: siteId,
    active_visitors: liveCount,
    live_visitors: liveCount,
    pages: activePages.map((p) => ({ page: p.page, visitors: Number(p.visitors) })),
  };
}
