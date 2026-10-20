import { analyticsReadSql as pgSql } from "../../../db";
import { hourlyRows } from "../rollups/reads";
import { filterSql } from "../lib/filter-sql";
import { readScope } from "../lib/read-scope";

/**
 * Pageviews and visitors by hour of day, over the whole window.
 *
 * The window is the dashboard's, whatever its length. It used to be held to seven days
 * without saying so, which made the hourly tab of a 30-day view a different week's chart
 * from the daily tab beside it. Over a long range each bucket is that clock hour summed
 * across every day — the shape of a typical day, which is what the tab is for.
 */
export async function getHourlyStatsAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const { span, tz, filters, useRollups } = readScope(query, 1);

  // Raw SQL avoids Drizzle generating separate parameter bindings for the same
  // timezone expression in SELECT vs GROUP BY, which causes Postgres error 42803.
  const rows = useRollups ? await hourlyRows(websiteId, span, tz) : await pgSql<{ h: number; views: number; unique: number }[]>`
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
        AND occurred_at >= ${span.start}
        AND occurred_at < ${span.end}
        ${filterSql(filters, websiteId, span)}
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
