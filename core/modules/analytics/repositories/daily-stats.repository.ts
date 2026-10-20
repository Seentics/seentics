import { analyticsReadSql as pgSql } from "../../../db";
import { dailyRows } from "../rollups/reads";
import { filterSql } from "../lib/filter-sql";
import { readScope } from "../lib/read-scope";
import { datesBetween } from "../lib/analytics-window";

export async function getDailyStatsAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const { span, tz, filters, useRollups } = readScope(query, 30);

  const rows = useRollups ? await dailyRows(websiteId, span, tz) : await pgSql<{
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
        -- From the start of the viewer's local day (lib/analytics-window.ts): a rolling
        -- now-minus-N-days window began mid-day, so the first bar was a partial one.
        AND occurred_at >= ${span.start}
        AND occurred_at < ${span.end}
        ${filterSql(filters, websiteId, span)}
      GROUP BY 1, 2
    ) per_visitor
    GROUP BY date
    ORDER BY date ASC
  `;

  // Every day of the window, a day without pageviews as zero. The chart and the comparison
  // overlay line days up by position, and a skipped day shifted every later one.
  const byDate = new Map(rows.map((x) => [x.date, x]));
  return {
    daily_stats: datesBetween(span.fromDate, span.toDate).map((date) => {
      const x = byDate.get(date);
      return { date, views: Number(x?.views ?? 0), unique: Number(x?.unique_visitors ?? 0) };
    }),
  };
}
