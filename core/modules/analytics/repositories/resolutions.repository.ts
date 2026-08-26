import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

export async function getResolutionsAnalytics(
  siteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);
  const rows = await pgSql<{ resolution: string; views: number; unique: number }[]>`
    SELECT
      screen_width::text || 'x' || screen_height::text AS resolution,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND screen_width IS NOT NULL
      AND screen_height IS NOT NULL
    GROUP BY screen_width, screen_height
    ORDER BY views DESC, screen_width ASC, screen_height ASC
    LIMIT 30
  `;
  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_resolutions: rows.map((r) => ({
      resolution: r.resolution,
      views: Number(r.views),
      unique: Number(r.unique),
    })),
  };
}
