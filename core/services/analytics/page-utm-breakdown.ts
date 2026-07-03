import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getPageUtmBreakdownAnalytics(
  websiteParam: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 7);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{
    page: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    views: number;
    unique_visitors: number;
  }[]>`
    SELECT
      page,
      utm_source,
      utm_medium,
      utm_campaign,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
      AND page IS NOT NULL
    GROUP BY page, utm_source, utm_medium, utm_campaign
    ORDER BY views DESC, page ASC, utm_source ASC, utm_medium ASC, utm_campaign ASC
    LIMIT 200
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    breakdown: rows.map((r) => ({
      page: r.page,
      utm_source: r.utm_source ?? null,
      utm_medium: r.utm_medium ?? null,
      utm_campaign: r.utm_campaign ?? null,
      views: Number(r.views),
      unique_visitors: Number(r.unique_visitors),
    })),
  };
}
