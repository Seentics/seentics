import { and, desc, eq, gte, sql as dsql } from "drizzle-orm";
import { analyticsEvents, db } from "../../db";
import { countDistinctVisitorsSql, parseDays, resolveSiteId } from "./shared";

export async function getLanguagesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      language: analyticsEvents.language,
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
    .groupBy(analyticsEvents.language)
    .orderBy(desc(dsql`count(*)`))
    .limit(30);
  return {
    website_id: siteId,
    top_languages: rows
      .filter((r) => r.language)
      .map((r) => ({ language: r.language!, views: r.views, unique: r.unique })),
  };
}
