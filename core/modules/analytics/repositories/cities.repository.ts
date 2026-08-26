import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

export async function getCitiesAnalytics(
  siteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);

  const rows = await pgSql<{ city: string; views: number; unique: number }[]>`
    SELECT
      city,
      count(*)::int                                                                       AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int             AS unique
    FROM analytics_events
    WHERE website_id  = ${siteId}
      AND event_type  = 'pageview'
      AND occurred_at >= ${startIso}
      AND city IS NOT NULL
      AND length(trim(city)) > 0
    GROUP BY city
    ORDER BY views DESC, city ASC
    LIMIT 30
  `;

  return {
    website_id: siteId,
    top_cities: rows.map((r) => ({ city: r.city, views: r.views, unique: r.unique })),
  };
}
