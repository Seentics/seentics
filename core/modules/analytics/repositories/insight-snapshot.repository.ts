import { analyticsReadSql as pgSql } from "../../../db";
import type { InsightSnapshotData } from "../interfaces";

/**
 * The aggregates behind the dashboard's daily insight: this window against the one before it.
 *
 * Counts only, never rows: the model that words an insight is not shown events, and neither is
 * the code that decides what is worth saying. Two queries do the work, both over the two windows
 * at once:
 *
 *  1. one row per (period, device, channel) of sessions with their visitors, pageviews, bounces,
 *     duration and conversions. Overall traffic, the device split and the channel split are all
 *     sums of those rows, so a site is scanned once for all three.
 *  2. the top pages, by views in each window.
 *
 * Plus one small lookup to pick the site's conversion event. Scheduled daily and only for sites
 * with traffic, so none of this runs on a page load.
 */

/** Custom events that mean a visitor did what the site is for, most specific first. */
export const CONVERSION_EVENTS = [
  "purchase", "order_completed", "checkout_completed", "ecommerce_purchase", "transaction",
  "signup", "sign_up", "lead_captured", "subscribe", "booked", "registered", "donation_completed",
] as const;

type SessionGroup = {
  cur: boolean;
  device: string | null;
  channel: string | null;
  sessions: number;
  visitors: number;
  pageviews: number;
  bounces: number;
  duration_sec: number;
  conversions: number;
};

const addPair = (p: { cur: number; prev: number }, cur: boolean, n: number) => { if (cur) p.cur += n; else p.prev += n; };

export async function getInsightSnapshotData(websiteId: string, days: number, now = new Date()): Promise<InsightSnapshotData> {
  const end = now.toISOString();
  const curStart = new Date(now.getTime() - days * 86_400_000).toISOString();
  const prevStart = new Date(now.getTime() - 2 * days * 86_400_000).toISOString();

  const [conversionRow] = await pgSql<{ event: string; cur: number; prev: number }[]>`
    SELECT event_type AS event,
           count(*) FILTER (WHERE occurred_at >= ${curStart})::int AS cur,
           count(*) FILTER (WHERE occurred_at < ${curStart})::int AS prev
    FROM analytics_events
    WHERE website_id = ${websiteId}
      AND occurred_at >= ${prevStart} AND occurred_at <= ${end}
      AND event_type = ANY(${[...CONVERSION_EVENTS]})
    GROUP BY event_type
    ORDER BY count(*) DESC, event_type
    LIMIT 1
  `;
  const conversionEvent = conversionRow?.event ?? null;

  const [groups, visitorTotals, pages] = await Promise.all([
    pgSql<SessionGroup[]>`
      WITH s AS (
        SELECT
          session_id,
          min(occurred_at) AS started,
          max(occurred_at) AS ended,
          count(*) FILTER (WHERE event_type = 'pageview')::int AS pvc,
          (array_agg(device ORDER BY occurred_at) FILTER (WHERE event_type = 'pageview'))[1] AS device,
          (array_agg(channel ORDER BY occurred_at) FILTER (WHERE event_type = 'pageview'))[1] AS channel,
          (array_agg(coalesce(nullif(trim(visitor_id), ''), session_id)) FILTER (WHERE event_type = 'pageview'))[1] AS visitor,
          bool_or(${conversionEvent}::text IS NOT NULL AND event_type = ${conversionEvent}::text) AS converted
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND occurred_at >= ${prevStart} AND occurred_at <= ${end}
          AND session_id IS NOT NULL AND length(trim(session_id)) > 0
        GROUP BY session_id
        HAVING count(*) FILTER (WHERE event_type = 'pageview') >= 1
      )
      SELECT
        (started >= ${curStart}) AS cur,
        device, channel,
        count(*)::int AS sessions,
        count(DISTINCT visitor)::int AS visitors,
        coalesce(sum(pvc), 0)::int AS pageviews,
        count(*) FILTER (WHERE pvc = 1)::int AS bounces,
        coalesce(sum(GREATEST(0, EXTRACT(EPOCH FROM (ended - started)))), 0)::int AS duration_sec,
        count(*) FILTER (WHERE converted)::int AS conversions
      FROM s
      GROUP BY 1, 2, 3
    `,
    // Distinct visitors per period overall: a visitor with sessions in two channels is one visitor.
    pgSql<{ cur: boolean; visitors: number }[]>`
      SELECT occurred_at >= ${curStart} AS cur,
             count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM analytics_events
      WHERE website_id = ${websiteId} AND event_type = 'pageview'
        AND occurred_at >= ${prevStart} AND occurred_at <= ${end}
      GROUP BY 1
    `,
    pgSql<{ path: string; cur_views: number; prev_views: number }[]>`
      SELECT coalesce(nullif(page, ''), '/') AS path,
             count(*) FILTER (WHERE occurred_at >= ${curStart})::int AS cur_views,
             count(*) FILTER (WHERE occurred_at < ${curStart})::int AS prev_views
      FROM analytics_events
      WHERE website_id = ${websiteId} AND event_type = 'pageview'
        AND occurred_at >= ${prevStart} AND occurred_at <= ${end}
      GROUP BY 1
      ORDER BY count(*) FILTER (WHERE occurred_at >= ${curStart}) DESC
      LIMIT 25
    `,
  ]);

  const zero = () => ({ cur: 0, prev: 0 });
  const traffic = { visitors: zero(), pageviews: zero(), sessions: zero(), bounces: zero(), durationSec: zero() };
  const devices = new Map<string, { sessions: { cur: number; prev: number }; bounces: { cur: number; prev: number }; conversions: { cur: number; prev: number } }>();
  const channels = new Map<string, { visitors: { cur: number; prev: number }; sessions: { cur: number; prev: number }; pageviews: { cur: number; prev: number }; bounces: { cur: number; prev: number } }>();

  for (const g of groups) {
    addPair(traffic.sessions, g.cur, g.sessions);
    addPair(traffic.pageviews, g.cur, g.pageviews);
    addPair(traffic.bounces, g.cur, g.bounces);
    addPair(traffic.durationSec, g.cur, g.duration_sec);

    const dName = (g.device || "unknown").toLowerCase();
    const d = devices.get(dName) ?? { sessions: zero(), bounces: zero(), conversions: zero() };
    addPair(d.sessions, g.cur, g.sessions); addPair(d.bounces, g.cur, g.bounces); addPair(d.conversions, g.cur, g.conversions);
    devices.set(dName, d);

    const cName = g.channel || "direct";
    const c = channels.get(cName) ?? { visitors: zero(), sessions: zero(), pageviews: zero(), bounces: zero() };
    addPair(c.visitors, g.cur, g.visitors); addPair(c.sessions, g.cur, g.sessions); addPair(c.pageviews, g.cur, g.pageviews); addPair(c.bounces, g.cur, g.bounces);
    channels.set(cName, c);
  }
  for (const v of visitorTotals) addPair(traffic.visitors, v.cur, v.visitors);

  return {
    days,
    traffic: {
      visitors: traffic.visitors,
      pageviews: traffic.pageviews,
      sessions: traffic.sessions,
      bounces: traffic.bounces,
      durationSec: traffic.durationSec,
    },
    devices: [...devices.entries()].map(([name, d]) => ({ name, sessions: d.sessions, bounces: d.bounces, conversions: d.conversions })),
    channels: [...channels.entries()].map(([name, c]) => ({ name, visitors: c.visitors, sessions: c.sessions, pageviews: c.pageviews, bounces: c.bounces })),
    pages: pages.map((p) => ({ path: p.path, views: { cur: p.cur_views, prev: p.prev_views } })),
    conversion: conversionRow ? { event: conversionRow.event, count: { cur: conversionRow.cur, prev: conversionRow.prev } } : null,
  };
}
