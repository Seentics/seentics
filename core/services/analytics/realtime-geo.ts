import { and, eq, gte, sql } from "drizzle-orm";
import { analyticsEvents, db } from "../../db";
import { resolveSiteId } from "./shared";

const REALTIME_GEO_DEFAULT_MINUTES = 30;

export interface RealtimeGeoData {
  website_id: string;
  date_range: string;
  visitors: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Get realtime geolocation breakdown of active visitors.
 * Aggregates visitor count by country from recent activity within the specified time window.
 */
export async function getRealtimeGeoAnalytics(
  websiteParam: string,
  opts?: { withinMinutes?: number },
): Promise<RealtimeGeoData> {
  const { siteId } = await resolveSiteId(websiteParam);
  const withinMin = opts?.withinMinutes ?? REALTIME_GEO_DEFAULT_MINUTES;

  const start = new Date(Date.now() - withinMin * 60_000);

  // Aggregate visitor count by country
  const rows = await db
    .select({
      country: analyticsEvents.country,
      count: sql<number>`COUNT(DISTINCT ${analyticsEvents.visitorId})`.as("count"),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
      ),
    )
    .groupBy(analyticsEvents.country);

  // Calculate total and percentages
  const totalVisitors = rows.reduce((sum, row) => sum + row.count, 0);

  const visitors = rows
    .map((row) => ({
      name: row.country || "Unknown",
      count: row.count,
      percentage: totalVisitors > 0 ? (row.count / totalVisitors) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    website_id: siteId,
    date_range: `${withinMin}m`,
    visitors,
  };
}
