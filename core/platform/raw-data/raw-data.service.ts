import { and, desc, eq, gte, lte } from "drizzle-orm";
import { analyticsEvents, db } from "../../db";
import { resolveWebsiteIds } from "../lib/website-resolve";
import * as heatmapSvc from "../../modules/heatmaps/services/page-query.service";
import * as replaySvc from "../../modules/recordings/services/session-list.service";

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
    // Stable total order: occurred_at can tie, so add the unique PK as a
    // tiebreaker — without it, offset pagination can skip/duplicate rows.
    .orderBy(desc(analyticsEvents.occurredAt), desc(analyticsEvents.id))
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

/**
 * Session recordings for the raw API. Takes identifiers already resolved by the
 * API-key middleware rather than re-resolving a loose reference.
 */
export async function rawSessions(
  siteId: string,
  websiteUuid: string,
  limit: number,
  offset: number,
) {
  return replaySvc.listReplaySessionsRaw(siteId, websiteUuid, limit, offset);
}

/**
 * Heatmap reads for the raw API.
 *
 * These take `websiteUuid` — already resolved by the API-key middleware, which had
 * to look the website up to authenticate the request — rather than a loose
 * reference they would have to resolve a second time.
 */
export async function rawHeatmapPages(websiteUuid: string) {
  return heatmapSvc.listHeatmapPages(websiteUuid);
}

export async function rawHeatmapPoints(
  websiteUuid: string,
  pagePath: string,
  eventType: string,
) {
  return heatmapSvc.getHeatmapPointsRaw(websiteUuid, pagePath, eventType);
}
