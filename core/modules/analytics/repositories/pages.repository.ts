import { sql as pgSql } from "../../../db";
import { orNotSet, parseDays, windowStartIso } from "./shared";

/**
 * Top pages by pageview count over the trailing window.
 *
 * Takes an already-resolved `siteId` — resolution is the service's job, done once
 * per request against the websites module rather than repeated here.
 */
export async function getPagesAnalytics(
  siteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);

  const rows = await pgSql<
    {
      page: string;
      views: number;
      unique_visitors: number;
    }[]
  >`
    SELECT
      page,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${windowStartIso(days)}
      AND page IS NOT NULL
      AND length(trim(page)) > 0
    GROUP BY page
    ORDER BY views DESC, page ASC
    LIMIT 50
  `;

  return {
    top_pages: rows.map((r) => ({
      page: orNotSet(r.page),
      views: Number(r.views),
      unique: Number(r.unique_visitors),
    })),
  };
}
