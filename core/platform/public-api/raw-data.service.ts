import type { AnalyticsRawEvents } from "../../modules/analytics/interfaces";
import type { HeatmapRawReads } from "../../modules/heatmaps/interfaces";
import type { RecordingRawReads } from "../../modules/recordings/interfaces";

/**
 * The raw API's read layer.
 *
 * Every read now goes through the owning module's port. This file previously held its
 * own Drizzle projection of `analytics_events` and imported
 * `modules/heatmaps/services/page-query.service` and
 * `modules/recordings/services/session-list.service` directly — a platform-level HTTP
 * surface reaching into three modules, two of them past their public interface.
 *
 * All three take identifiers the API-key middleware already resolved, rather than
 * re-resolving a loose reference the way the analytics path used to.
 */
export type RawDataPorts = {
  analyticsEvents: AnalyticsRawEvents;
  heatmaps: HeatmapRawReads;
  recordings: RecordingRawReads;
};

export async function rawAnalyticsEvents(
  ports: RawDataPorts,
  websiteId: string,
  q: { from?: string; to?: string; limit?: number; offset?: number; event_type?: string },
) {
  const limit = Math.min(Math.max(1, q.limit ?? 100), 10_000);
  const offset = Math.max(0, q.offset ?? 0);
  const from = q.from ? new Date(q.from) : undefined;
  const to = q.to ? new Date(q.to) : undefined;
  if (from && Number.isNaN(from.getTime())) throw new Error("bad from");
  if (to && Number.isNaN(to.getTime())) throw new Error("bad to");

  const events = await ports.analyticsEvents.listRawEvents(websiteId, {
    from,
    to,
    limit,
    offset,
    eventType: q.event_type,
  });

  return {
    websiteId: websiteId,
    limit,
    offset,
    returned: events.length,
    events,
  };
}

/** Session recordings for the raw API. */
export async function rawSessions(
  ports: RawDataPorts,
  websiteId: string,
  limit: number,
  offset: number,
) {
  return ports.recordings.listSessionsRaw(websiteId, limit, offset);
}

/** Heatmap page list for the raw API. */
export async function rawHeatmapPages(ports: RawDataPorts, websiteId: string) {
  return ports.heatmaps.listPagesRaw(websiteId);
}

/** Heatmap points for one page, for the raw API. */
export async function rawHeatmapPoints(
  ports: RawDataPorts,
  websiteId: string,
  pagePath: string,
  eventType: string,
) {
  return ports.heatmaps.getPointsRaw(websiteId, pagePath, eventType);
}
