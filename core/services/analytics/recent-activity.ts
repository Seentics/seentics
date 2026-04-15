import { and, desc, eq, gte } from "drizzle-orm";
import { analyticsEvents, db } from "../../db";
import { occurredAtToIso, resolveSiteId } from "./shared";

const RECENT_ACTIVITY_DEFAULT_DAYS = 30;

export async function getRecentActivityAnalytics(websiteParam: string, limit: number) {
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - RECENT_ACTIVITY_DEFAULT_DAYS * 86400000);
  const rows = await db
    .select({
      eventType: analyticsEvents.eventType,
      page: analyticsEvents.page,
      visitorId: analyticsEvents.visitorId,
      sessionId: analyticsEvents.sessionId,
      country: analyticsEvents.country,
      browser: analyticsEvents.browser,
      device: analyticsEvents.device,
      referrer: analyticsEvents.referrer,
      occurredAt: analyticsEvents.occurredAt,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(Math.min(limit, 100));
  return {
    website_id: siteId,
    date_range: `${RECENT_ACTIVITY_DEFAULT_DAYS}d`,
    activity: rows.map((e) => ({
      type: e.eventType,
      page: e.page,
      visitor_id: e.visitorId,
      session_id: e.sessionId,
      country: e.country,
      browser: e.browser,
      device: e.device,
      referrer: e.referrer,
      occurred_at: occurredAtToIso(e.occurredAt as Date | string),
    })),
  };
}
