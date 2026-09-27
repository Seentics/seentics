import { analyticsReadSql as pgSql } from "../../../db";
import { pagePathSql } from "../lib/dimension-sql";
import { parseDays, windowStartIso } from "./shared";

export async function getPageUtmBreakdownAnalytics(
  websiteId: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 7);
  const startIso = windowStartIso(days);

  const rows = await pgSql<{
    page: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    views: number;
    unique_visitors: number;
  }[]>`
    -- Distinct visitors by grouping (see pages.repository.ts for why and the numbers).
    SELECT
      page,
      utm_source,
      utm_medium,
      utm_campaign,
      sum(n)::int AS views,
      count(vk)::int AS unique_visitors
    FROM (
      SELECT
        ${pgSql.unsafe(pagePathSql("page"))} AS page, utm_source, utm_medium, utm_campaign,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vk,
        count(*) AS n
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
        AND page IS NOT NULL
      GROUP BY 1, 2, 3, 4, 5
    ) per_visitor
    GROUP BY page, utm_source, utm_medium, utm_campaign
    ORDER BY views DESC, page ASC, utm_source ASC, utm_medium ASC, utm_campaign ASC
    LIMIT 200
  `;

  return {
    website_id: websiteId,
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
