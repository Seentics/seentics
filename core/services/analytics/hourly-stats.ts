import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId, sanitizeTimezone } from "./shared";

export async function getHourlyStatsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = Math.min(parseDays(query.days, 1), 7);
  const tz = sanitizeTimezone(query.timezone);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000).toISOString();

  // Raw SQL avoids Drizzle generating separate parameter bindings for the same
  // timezone expression in SELECT vs GROUP BY, which causes Postgres error 42803.
  const rows = await pgSql<{ h: number; views: number; unique: number }[]>`
    SELECT
      extract(hour from occurred_at AT TIME ZONE ${tz})::int AS h,
      count(*)::int AS views,
      count(distinct coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${start}
    GROUP BY 1
    ORDER BY h
  `;

  // No `timestamp` field: stats aggregate the same clock hour across the whole
  // range (potentially multiple days), so a single absolute timestamp per bucket
  // is meaningless. The dashboard chart only consumes hour/hour_label/views/unique.
  return {
    website_id: siteId,
    hourly_stats: rows.map((x) => ({
      hour: x.h,
      views: x.views,
      unique: x.unique,
      hour_label: `${String(x.h).padStart(2, "0")}:00`,
    })),
  };
}
