import { and, desc, eq, gte, sql as dsql } from "drizzle-orm";
import { analyticsEvents, db } from "../../db";
import { countDistinctVisitorsSql, parseDays, resolveSiteId } from "./shared";

export async function getCitiesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      city: analyticsEvents.city,
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
    .groupBy(analyticsEvents.city)
    .orderBy(desc(dsql`count(*)`))
    .limit(30);
  return {
    website_id: siteId,
    top_cities: rows
      .filter((r) => r.city)
      .map((r) => ({ city: r.city!, views: r.views, unique: r.unique })),
  };
}
