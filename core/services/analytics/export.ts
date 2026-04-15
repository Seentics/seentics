import { and, desc, eq, gte } from "drizzle-orm";
import { analyticsEvents, db } from "../../db";
import { occurredAtToIso, parseDays, resolveSiteId } from "./shared";

export async function getExportAnalytics(
  websiteParam: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 30);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      eventType: analyticsEvents.eventType,
      page: analyticsEvents.page,
      visitorId: analyticsEvents.visitorId,
      sessionId: analyticsEvents.sessionId,
      referrer: analyticsEvents.referrer,
      country: analyticsEvents.country,
      city: analyticsEvents.city,
      browser: analyticsEvents.browser,
      device: analyticsEvents.device,
      os: analyticsEvents.os,
      language: analyticsEvents.language,
      utmSource: analyticsEvents.utmSource,
      utmMedium: analyticsEvents.utmMedium,
      utmCampaign: analyticsEvents.utmCampaign,
      screenWidth: analyticsEvents.screenWidth,
      screenHeight: analyticsEvents.screenHeight,
      occurredAt: analyticsEvents.occurredAt,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(10_000);
  return {
    website_id: siteId,
    date_range: `${days}d`,
    format: "json",
    total: rows.length,
    data: rows.map((e) => ({
      event_type: e.eventType,
      page: e.page,
      visitor_id: e.visitorId,
      session_id: e.sessionId,
      referrer: e.referrer,
      country: e.country,
      city: e.city,
      browser: e.browser,
      device: e.device,
      os: e.os,
      language: e.language,
      utm_source: e.utmSource,
      utm_medium: e.utmMedium,
      utm_campaign: e.utmCampaign,
      screen_width: e.screenWidth,
      screen_height: e.screenHeight,
      occurred_at: occurredAtToIso(e.occurredAt as Date | string),
    })),
  };
}
