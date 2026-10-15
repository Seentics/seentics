import { and, gte, inArray, sql } from "drizzle-orm";
import { analyticsEvents, analyticsReadSql, db } from "../../../db";
import type { TrafficSummary } from "../interfaces";
import { rollupWindow, rollupsEnabled } from "../rollups/reads";

/** Window the dashboard summarises over. */
const WINDOW_DAYS = 30;

type SiteRow = { websiteId: string; pageviews: number | string | null; visitors: number | string | null };

/**
 * Backs `AnalyticsModule.getTrafficSummary`.
 *
 * Living here rather than in the websites module is the point: `analytics_events` is
 * analytics-owned, and this is the one place the websites list learns anything about
 * it. Swapping the storage engine or changing how a visitor or a bounce is counted
 * touches this file and nothing in `modules/websites`.
 */
export class AnalyticsTrafficSummaryService {
  async summarizeSites(websiteIds: string[]): Promise<Map<string, TrafficSummary>> {
    const summaries = new Map<string, TrafficSummary>();
    // `inArray` with an empty list produces `IN ()`, which is invalid SQL.
    if (websiteIds.length === 0) return summaries;

    // One grouped query for every site. The previous implementation ran two
    // sequential queries per site, so a user with twenty sites paid forty round
    // trips to render the list.
    const rows = rollupsEnabled() ? await fromRollups(websiteIds) : await fromRawEvents(websiteIds);

    for (const row of rows) {
      summaries.set(row.websiteId, {
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

/**
 * The site totals from the daily rollup: a few dozen rows per site instead of every raw
 * event in the window, which on a 1M-session site took seconds and sat on the critical
 * path of the websites list and every page that loads it. Same window and visitor count
 * as the dashboard's 30-day view (`rollups/reads.ts`), so the two agree.
 *
 * No `ensureFresh` here: kicking a rebuild for every site in the list would cost more
 * than the list itself, and the background builder keeps them within about 30 seconds.
 */
async function fromRollups(websiteIds: string[]): Promise<SiteRow[]> {
  const w = rollupWindow(WINDOW_DAYS);
  return analyticsReadSql<SiteRow[]>`
    SELECT
      website_id AS "websiteId",
      sum(pageviews)::bigint AS pageviews,
      coalesce(round(hll_cardinality(hll_union_agg(visitors))), 0)::int AS visitors
    FROM analytics_rollup_daily
    WHERE website_id = ANY(${websiteIds}::text[]) AND dimension = 'site'
      AND day BETWEEN ${w.from}::date AND ${w.to}::date
    GROUP BY website_id
  `;
}

/** Without the `hll` extension there are no rollups: count the raw events. */
async function fromRawEvents(websiteIds: string[]): Promise<SiteRow[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  return db
    .select({
      websiteId: analyticsEvents.websiteId,
      pageviews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'pageview')::int`,
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
    })
    .from(analyticsEvents)
    .where(and(inArray(analyticsEvents.websiteId, websiteIds), gte(analyticsEvents.occurredAt, since)))
    .groupBy(analyticsEvents.websiteId);
}
