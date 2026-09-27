import { analyticsReadSql as pgSql } from "../../../db";
import { parseDays, sanitizeTimezone, windowStartIso } from "./shared";
import { hourlyRows, rollupsEnabled } from "../rollups/reads";

export async function getHourlyStatsAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = Math.min(parseDays(query.days, 1), 7);
  const tz = sanitizeTimezone(query.timezone);
  const start = windowStartIso(days);

  // Raw SQL avoids Drizzle generating separate parameter bindings for the same
  // timezone expression in SELECT vs GROUP BY, which causes Postgres error 42803.
  const rows = rollupsEnabled() ? await hourlyRows(websiteId, days, tz) : await pgSql<{ h: number; views: number; unique: number }[]>`
    -- Views and distinct visitors in two hash-aggregation steps: one row per (hour,
    -- visitor), then one per hour. count(DISTINCT …) always sorts, and over a large
    -- window that sort spilled to disk — 32.8 s for a 90-day top-pages over 633k
    -- pageviews against 3.6 s this way, identical results. count(vk) skips a NULL
    -- visitor key exactly as count(DISTINCT …) did.
    SELECT h, sum(n)::int AS views, count(vk)::int AS unique
    FROM (
      SELECT
        extract(hour from occurred_at AT TIME ZONE ${tz})::int AS h,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vk,
        count(*) AS n
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${start}
      GROUP BY 1, 2
    ) per_visitor
    GROUP BY h
    ORDER BY h
  `;

  // No `timestamp` field: stats aggregate the same clock hour across the whole
  // range (potentially multiple days), so a single absolute timestamp per bucket
  // is meaningless. The dashboard chart only consumes hour/hour_label/views/unique.
  return {
    website_id: websiteId,
    hourly_stats: rows.map((x) => ({
      hour: x.h,
      views: x.views,
      unique: x.unique,
      hour_label: `${String(x.h).padStart(2, "0")}:00`,
    })),
  };
}
