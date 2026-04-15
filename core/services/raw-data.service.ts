import { and, desc, eq, gte, lte } from "drizzle-orm";
import { analyticsEvents, db } from "../db";
import { resolveWebsiteIds } from "../lib/website-resolve";
import * as heatmapSvc from "./heatmaps.service";
import * as replaySvc from "./replays.service";

export async function rawAnalyticsEvents(
  websiteParam: string,
  q: {
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
    event_type?: string;
  },
) {
  const { siteId, uuidStr } = await resolveWebsiteIds(websiteParam);
  const limit = Math.min(Math.max(1, q.limit ?? 100), 10_000);
  const offset = Math.max(0, q.offset ?? 0);
  const from = q.from ? new Date(q.from) : undefined;
  const to = q.to ? new Date(q.to) : undefined;
  if (from && Number.isNaN(from.getTime())) throw new Error("bad from");
  if (to && Number.isNaN(to.getTime())) throw new Error("bad to");

  const cond = [eq(analyticsEvents.websiteId, siteId)];
  if (from) cond.push(gte(analyticsEvents.occurredAt, from));
  if (to) cond.push(lte(analyticsEvents.occurredAt, to));
  if (q.event_type) cond.push(eq(analyticsEvents.eventType, q.event_type));

  const rows = await db
    .select({
      id: analyticsEvents.id,
      eventType: analyticsEvents.eventType,
      page: analyticsEvents.page,
      visitorId: analyticsEvents.visitorId,
      sessionId: analyticsEvents.sessionId,
      occurredAt: analyticsEvents.occurredAt,
      properties: analyticsEvents.properties,
    })
    .from(analyticsEvents)
    .where(and(...cond))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(limit)
    .offset(offset);

  return {
    siteId,
    uuidStr,
    limit,
    offset,
    returned: rows.length,
    events: rows.map((e) => ({
      id: e.id,
      event_type: e.eventType,
      page: e.page,
      visitor_id: e.visitorId,
      session_id: e.sessionId,
      occurred_at: e.occurredAt.toISOString(),
      properties: e.properties ?? null,
    })),
  };
}

export async function rawSessions(websiteParam: string, limit: number, offset: number) {
  return replaySvc.listReplaySessionsRaw(websiteParam, limit, offset);
}

export async function rawHeatmapPages(websiteParam: string) {
  return heatmapSvc.listHeatmapPagesRaw(websiteParam);
}

export async function rawHeatmapPoints(
  websiteParam: string,
  pagePath: string,
  eventType: string,
) {
  return heatmapSvc.getHeatmapPointsRaw(websiteParam, pagePath, eventType);
}
