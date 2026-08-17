import { sql as pgSql } from "../../../db";
import { parseDays, sanitizeTimezone, windowStartIso } from "./shared";

export async function getDailyStatsAnalytics(
  siteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days, 30);
  const tz = sanitizeTimezone(query.timezone);
  const startIso = windowStartIso(days);

  const rows = await pgSql<{
    date: string;
    views: number;
    unique_visitors: number;
  }[]>`
    SELECT
      date_trunc('day', occurred_at AT TIME ZONE ${tz})::date::text AS date,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return {
    daily_stats: rows.map((x) => ({
      date:   x.date,
      views:  Number(x.views),
      unique: Number(x.unique_visitors),
    })),
  };
}
