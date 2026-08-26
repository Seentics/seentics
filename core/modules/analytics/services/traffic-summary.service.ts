import { and, gte, inArray, sql } from "drizzle-orm";
import { analyticsEvents, db } from "../../../db";
import type {
  TrafficSummary,
  TrafficSummaryProvider,
} from "../../websites/interfaces";

/** Window the dashboard summarises over. */
const WINDOW_DAYS = 30;

/**
 * Analytics-side implementation of the traffic port the websites module declares.
 *
 * Living here rather than in the websites module is the point: `analytics_events`
 * is analytics-owned, and this is the one place the websites list learns anything
 * about it. Swapping the storage engine or the metric definitions changes this
 * file and nothing in `modules/websites`.
 */
export class AnalyticsTrafficSummaryService implements TrafficSummaryProvider {
  async summarizeSites(siteIds: string[]): Promise<Map<string, TrafficSummary>> {
    const summaries = new Map<string, TrafficSummary>();
    // `inArray` with an empty list produces `IN ()`, which is invalid SQL.
    if (siteIds.length === 0) return summaries;

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

    // One grouped query for every site. The previous implementation ran two
    // sequential queries per site, so a user with twenty sites paid forty round
    // trips to render the list.
    const rows = await db
      .select({
        siteId: analyticsEvents.websiteId,
        pageviews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'pageview')::int`,
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
      })
      .from(analyticsEvents)
      .where(
        and(inArray(analyticsEvents.websiteId, siteIds), gte(analyticsEvents.occurredAt, since)),
      )
      .groupBy(analyticsEvents.websiteId);

    for (const row of rows) {
      summaries.set(row.siteId, {
        totalPageviews: Number(row.pageviews ?? 0),
        uniqueVisitors: Number(row.visitors ?? 0),
        // Not yet derived here. Reported as zero rather than omitted so the
        // shape stays stable; the dashboard reads these from the dedicated
        // analytics endpoints, which compute them per-session.
        averageSessionDuration: 0,
        bounceRate: 0,
      });
    }

    // Sites with no traffic in the window are absent from `rows` and stay absent
    // from the map — callers fall back to `emptyTrafficSummary()`.
    return summaries;
  }
}
