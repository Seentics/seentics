import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getPagesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{
    page: string;
    views: number;
    unique_visitors: number;
  }[]>`
    SELECT
      page,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND page IS NOT NULL
      AND length(trim(page)) > 0
    GROUP BY page
    ORDER BY views DESC
    LIMIT 50
  `;

  return {
    top_pages: rows.map((r) => ({
      page: r.page?.trim() ? r.page : "(not set)",
      views: Number(r.views),
      unique: Number(r.unique_visitors),
    })),
  };
}
