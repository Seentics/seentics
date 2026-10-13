import type { AnalyticsInsightReads } from '../../analytics/interfaces';
import type { ErrorQueries } from '../../errors/interfaces';
import { maskPath, maskText } from './privacy';
import type { InsightSnapshot, Pair } from './types';

/**
 * Turns the counts the analytics module hands over, and the error groups, into the snapshot the
 * rest of the pipeline reads: rates worked out, and every path and message masked.
 *
 * This is the one place raw strings enter the insight pipeline, so it is where they stop being raw.
 */

export type SnapshotSources = {
  analytics: AnalyticsInsightReads;
  errors: Pick<ErrorQueries, 'listGroups'>;
};

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);
const pctPair = (n: Pair, d: Pair): Pair => ({ cur: ratio(n.cur, d.cur) * 100, prev: ratio(n.prev, d.prev) * 100 });
const perPair = (n: Pair, d: Pair): Pair => ({ cur: ratio(n.cur, d.cur), prev: ratio(n.prev, d.prev) });

/** How many errors an insight can draw on, and how long ago a group must have first been seen to be "new". */
const MAX_ERRORS = 5;

export async function readInsightSnapshot(
  src: SnapshotSources,
  websiteId: string,
  days: number,
  now: Date = new Date(),
): Promise<InsightSnapshot> {
  const [data, errorGroups] = await Promise.all([
    src.analytics.getInsightSnapshot(websiteId, days),
    // A failing errors read must not take the insight down with it: it is one source of several.
    src.errors.listGroups(websiteId, { days, status: 'unresolved', limit: 20 }).catch(() => ({ groups: [] })),
  ]);

  const t = data.traffic;
  const windowStart = now.getTime() - days * 86_400_000;

  // Masking can merge two paths into one (`/orders/1` and `/orders/2`): their views add up.
  const pages = new Map<string, Pair>();
  for (const p of data.pages) {
    const path = maskPath(p.path);
    const sum = pages.get(path) ?? { cur: 0, prev: 0 };
    pages.set(path, { cur: sum.cur + p.views.cur, prev: sum.prev + p.views.prev });
  }

  return {
    websiteId,
    days,
    traffic: {
      visitors: t.visitors,
      pageviews: t.pageviews,
      sessions: t.sessions,
      bounceRate: pctPair(t.bounces, t.sessions),
      avgSessionSec: perPair(t.durationSec, t.sessions),
    },
    devices: data.devices
      .map((d) => ({ name: maskText(d.name, 30), sessions: d.sessions, bounceRate: pctPair(d.bounces, d.sessions), conversions: d.conversions }))
      .sort((a, b) => b.sessions.cur - a.sessions.cur),
    channels: data.channels
      .map((c) => ({
        name: maskText(c.name, 40),
        visitors: c.visitors,
        sessions: c.sessions,
        pagesPerSession: perPair(c.pageviews, c.sessions),
        bounceRate: pctPair(c.bounces, c.sessions),
      }))
      .sort((a, b) => b.visitors.cur - a.visitors.cur),
    pages: [...pages.entries()].map(([path, views]) => ({ path, views })).sort((a, b) => b.views.cur - a.views.cur),
    conversion: data.conversion ? { event: maskText(data.conversion.event, 60), count: data.conversion.count } : null,
    errors: errorGroups.groups
      .filter((g) => new Date(g.last_seen).getTime() >= windowStart)
      .slice(0, MAX_ERRORS)
      .map((g) => ({
        message: maskText(g.message, 140),
        page: maskPath(g.last_page_path),
        count: g.event_count,
        isNew: new Date(g.first_seen).getTime() >= windowStart,
      })),
  };
}
