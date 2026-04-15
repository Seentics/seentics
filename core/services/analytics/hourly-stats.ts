import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { analyticsEvents, db } from "../../db";
import { countDistinctVisitorsSql, parseDays, resolveSiteId } from "./shared";

export async function getHourlyStatsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = Math.min(parseDays(query.days, 1), 7);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const hourBucket = dsql<number>`extract(hour from ${analyticsEvents.occurredAt} AT TIME ZONE 'UTC')::int`;
  const rows = await db
    .select({
      h: hourBucket,
      views: dsql<number>`count(*)::int`,
      unique: countDistinctVisitorsSql(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    )
    .groupBy(hourBucket)
    .orderBy(hourBucket);
  const todayUtcMidnight = new Date();
  todayUtcMidnight.setUTCHours(0, 0, 0, 0);
  return {
    website_id: siteId,
    hourly_stats: rows.map((x) => ({
      hour: x.h,
      timestamp: new Date(todayUtcMidnight.getTime() + x.h * 3600_000).toISOString(),
      views: x.views,
      unique: x.unique,
      hour_label: `${String(x.h).padStart(2, "0")}:00`,
    })),
  };
}
