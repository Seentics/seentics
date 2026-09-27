import { analyticsReadSql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";
import { rollupsEnabled, topRows } from "../rollups/reads";

export async function getResolutionsAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);
  const rows = rollupsEnabled()
    ? (await topRows(websiteId, "resolution", days, 30)).map((r) => ({ resolution: r.k, views: r.views, unique: r.unique_visitors }))
    : await pgSql<{ resolution: string; views: number; unique: number }[]>`
    -- Views and distinct visitors in two hash-aggregation steps: one row per (value,
    -- visitor), then one per value. count(DISTINCT …) always sorts, and over a large
    -- window that sort spilled to disk — 32.8 s for a 90-day top-pages over 633k
    -- pageviews against 3.6 s this way, identical results. count(vk) skips a NULL
    -- visitor key exactly as count(DISTINCT …) did.
    SELECT
      screen_width::text || 'x' || screen_height::text AS resolution,
      sum(n)::int AS views,
      count(vk)::int AS unique
    FROM (
      SELECT
        screen_width,
        screen_height,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vk,
        count(*) AS n
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND screen_width IS NOT NULL
        AND screen_height IS NOT NULL
      GROUP BY 1, 2, 3
    ) per_visitor
    GROUP BY screen_width, screen_height
    ORDER BY views DESC, screen_width ASC, screen_height ASC
    LIMIT 30
  `;
  return {
    website_id: websiteId,
    date_range: `${days}d`,
    top_resolutions: rows.map((r) => ({
      resolution: r.resolution,
      views: Number(r.views),
      unique: Number(r.unique),
    })),
  };
}
