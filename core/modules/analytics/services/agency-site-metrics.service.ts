import { analyticsReadSql, sql } from "../../../db";
import type {
  MetricTotals,
  MetricWindow,
  OverviewMetric,
  SiteMetricSource,
  TrackingActivity,
  TrackingActivityReader,
} from "../../agency/interfaces";
import { rollupsEnabled } from "../rollups/reads";

type Num = number | string | null;

/**
 * The agency overview's analytics figures for many sites at once: visitors, pageviews,
 * events and revenue over a window of UTC days.
 *
 * The same sources the dashboard reads, so the two agree: the daily rollup for visitors and
 * pageviews (raw events without the `hll` extension), `analytics_event_counts` for events —
 * what the plan quota counts — and the orders rollup for revenue. Revenue is the sum of
 * purchases as stored, in whatever currencies they were sent in; an agency with clients in
 * several currencies sees a mixed number, as the per-site revenue page explains.
 */
export class AnalyticsSiteMetrics implements SiteMetricSource {
  readonly metrics: readonly OverviewMetric[] = ["visitors", "pageviews", "events", "revenue"];

  async totalsBySite(websiteIds: readonly string[], window: MetricWindow): Promise<Map<string, MetricTotals>> {
    const out = new Map<string, MetricTotals>();
    if (websiteIds.length === 0) return out;
    const ids = [...websiteIds];
    const [traffic, events, revenue] = await Promise.all([
      rollupsEnabled() ? trafficFromRollups(ids, window) : trafficFromRawEvents(ids, window),
      sql<{ website_id: string; events: Num }[]>`
        SELECT website_id, sum(events)::bigint AS events
        FROM analytics_event_counts
        WHERE website_id = ANY(${ids}::text[]) AND day BETWEEN ${window.from}::date AND ${window.to}::date
        GROUP BY website_id
      `,
      rollupsEnabled() ? revenueFromOrders(ids, window) : revenueFromRawEvents(ids, window),
    ]);
    const at = (id: string) => out.get(id) ?? out.set(id, {}).get(id)!;
    for (const r of traffic) Object.assign(at(r.website_id), { visitors: Number(r.visitors ?? 0), pageviews: Number(r.pageviews ?? 0) });
    for (const r of events) at(r.website_id).events = Number(r.events ?? 0);
    for (const r of revenue) at(r.website_id).revenue = Math.round(Number(r.revenue ?? 0) * 100) / 100;
    return out;
  }
}

type TrafficRow = { website_id: string; pageviews: Num; visitors: Num };

function trafficFromRollups(ids: string[], w: MetricWindow) {
  return analyticsReadSql<TrafficRow[]>`
    SELECT website_id, sum(pageviews)::bigint AS pageviews,
           coalesce(round(hll_cardinality(hll_union_agg(visitors))), 0)::int AS visitors
    FROM analytics_rollup_daily
    WHERE website_id = ANY(${ids}::text[]) AND dimension = 'site'
      AND day BETWEEN ${w.from}::date AND ${w.to}::date
    GROUP BY website_id
  `;
}

/** Raw events are kept 31 days: past that, a long window without rollups undercounts. */
function trafficFromRawEvents(ids: string[], w: MetricWindow) {
  return sql<TrafficRow[]>`
    SELECT website_id,
           count(*) FILTER (WHERE event_type = 'pageview')::bigint AS pageviews,
           count(DISTINCT visitor_id)::int AS visitors
    FROM analytics_events
    WHERE website_id = ANY(${ids}::text[])
      AND occurred_at >= ${w.from}::date AND occurred_at < ${w.to}::date + 1
    GROUP BY website_id
  `;
}

type RevenueRow = { website_id: string; revenue: Num };

/** One row per order: the rollup deduplicates within a day, this across the window. */
function revenueFromOrders(ids: string[], w: MetricWindow) {
  return sql<RevenueRow[]>`
    SELECT website_id, sum(value)::double precision AS revenue
    FROM (
      SELECT DISTINCT ON (website_id, order_key) website_id, CASE WHEN abs(value) > 1e9 THEN 0.0 ELSE value END AS value
      FROM analytics_revenue_orders
      WHERE website_id = ANY(${ids}::text[]) AND kind = 'purchase'
        AND day BETWEEN ${w.from}::date AND ${w.to}::date
      ORDER BY website_id, order_key, occurred_at
    ) orders
    GROUP BY website_id
  `;
}

function revenueFromRawEvents(ids: string[], w: MetricWindow) {
  return sql<RevenueRow[]>`
    SELECT website_id, coalesce(sum(
      CASE WHEN (properties->>'value') ~ '^-?[0-9]+(\\.[0-9]+)?$' AND abs((properties->>'value')::double precision) <= 1e9
           THEN (properties->>'value')::double precision ELSE 0 END
    ), 0)::double precision AS revenue
    FROM analytics_events
    WHERE website_id = ANY(${ids}::text[]) AND event_type = 'purchase'
      AND occurred_at >= ${w.from}::date AND occurred_at < ${w.to}::date + 1
    GROUP BY website_id
  `;
}

/**
 * Whether sites' trackers are sending, for the install screen and the setup guide.
 *
 * The last day with events comes from `analytics_event_counts`, which is never reduced when
 * events expire, so a site that sent once a year ago still reads as installed. The exact
 * last event and the 24-hour count come from raw events, read only over the last day — or,
 * for a site that has gone quiet, from its last active day on.
 */
export class AnalyticsTrackingActivity implements TrackingActivityReader {
  async activity(websiteIds: readonly string[]): Promise<Map<string, TrackingActivity>> {
    const out = new Map<string, TrackingActivity>();
    if (websiteIds.length === 0) return out;
    const ids = [...websiteIds];
    const [days, recent] = await Promise.all([
      sql<{ website_id: string; last_day: string | Date }[]>`
        SELECT website_id, max(day) AS last_day FROM analytics_event_counts
        WHERE website_id = ANY(${ids}::text[]) AND events > 0
        GROUP BY website_id
      `,
      sql<{ website_id: string; last_at: string | Date; n: Num }[]>`
        SELECT website_id, max(occurred_at) AS last_at, count(*)::int AS n
        FROM analytics_events
        WHERE website_id = ANY(${ids}::text[]) AND occurred_at > now() - interval '24 hours'
        GROUP BY website_id
      `,
    ]);
    for (const r of recent) out.set(r.website_id, { lastEventAt: toDate(r.last_at), events24h: Number(r.n ?? 0) });

    const quiet = days.filter((d) => !out.has(d.website_id));
    if (quiet.length > 0) {
      const since = quiet.map((d) => dayOf(d.last_day)).sort()[0]!;
      const last = await sql<{ website_id: string; last_at: string | Date }[]>`
        SELECT website_id, max(occurred_at) AS last_at FROM analytics_events
        WHERE website_id = ANY(${quiet.map((d) => d.website_id)}::text[]) AND occurred_at >= ${since}::date
        GROUP BY website_id
      `;
      const exact = new Map(last.map((r) => [r.website_id, toDate(r.last_at)]));
      // Raw events gone (past retention): the start of the last active day is the best there is.
      for (const d of quiet) {
        out.set(d.website_id, { lastEventAt: exact.get(d.website_id) ?? new Date(`${dayOf(d.last_day)}T00:00:00Z`), events24h: 0 });
      }
    }
    return out;
  }
}

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(String(v)));
const dayOf = (v: string | Date) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
