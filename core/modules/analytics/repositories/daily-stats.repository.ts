import { analyticsReadSql as pgSql } from "../../../db";
import { parseDays, sanitizeTimezone, windowStartIso } from "./shared";
import { dailyRows, rollupsEnabled } from "../rollups/reads";

export async function getDailyStatsAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days, 30);
  const tz = sanitizeTimezone(query.timezone);
  const startIso = windowStartIso(days);

  const rows = rollupsEnabled() ? await dailyRows(websiteId, days, tz) : await pgSql<{
    date: string;
    views: number;
    unique_visitors: number;
  }[]>`
    -- Views and distinct visitors in two hash-aggregation steps: one row per (day,
    -- visitor), then one per day. count(DISTINCT …) always sorts, and over a large
    -- window that sort spilled to disk — 32.8 s for a 90-day top-pages over 633k
    -- pageviews against 3.6 s this way, identical results. count(vk) skips a NULL
    -- visitor key exactly as count(DISTINCT …) did.
    SELECT date, sum(n)::int AS views, count(vk)::int AS unique_visitors
    FROM (
      SELECT
        date_trunc('day', occurred_at AT TIME ZONE ${tz})::date::text AS date,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vk,
        count(*) AS n
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
      GROUP BY 1, 2
    ) per_visitor
    GROUP BY date
    ORDER BY date ASC
  `;

  return {
    daily_stats: rows.map((x) => ({
      date:   x.date,
      views:  Number(x.views),
      unique: Number(x.unique_visitors),
    })),
  };
}
