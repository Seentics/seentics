import type { ImpactCounts, ImpactCountsQuery } from '../../analytics/interfaces';
import { rate } from './impact';
import type { AutomationActivity, MetricValue, Recommendation } from './types';

/**
 * Where the readings come from. Each is another module's port, adapted in `init.ts`, so this code
 * never touches `analytics_events`, `funnels` or `automation_events` itself.
 */
export type ImpactPorts = {
  /** Session, bounce and conversion counts over a fixed window (analytics). */
  sessionCounts(websiteId: string, query: ImpactCountsQuery): Promise<ImpactCounts>;
  /** A funnel's entries and completions over a fixed window (funnels). `null`: no such funnel. */
  funnelCounts(websiteId: string, funnelId: string, from: Date, to: Date): Promise<{ entries: number; completions: number } | null>;
  /** An automation's execution totals (automations). `null`: not on this site. */
  automationActivity(websiteId: string, automationId: string): Promise<AutomationActivity | null>;
};

/** The funnel a recommendation measures: its target, or the funnel its draft created. */
export function funnelIdOf(rec: Pick<Recommendation, 'target' | 'resource'>): string | null {
  if (rec.target.kind === 'funnel' && rec.target.ref) return rec.target.ref;
  if (rec.resource?.resource === 'funnel') return rec.resource.id;
  return null;
}

/**
 * Read a recommendation's metric over one window.
 *
 * `event` fixes the conversion event: the baseline reads it (`undefined` picks the window's main
 * one) and every later reading passes the baseline's, so before and after count the same thing.
 * `null` when there is nothing to read (metric `none`, or a funnel that no longer exists).
 */
export async function readMetric(
  ports: ImpactPorts,
  rec: Pick<Recommendation, 'websiteId' | 'target' | 'metric' | 'resource'>,
  window: { from: Date; to: Date },
  event?: string | null,
): Promise<MetricValue | null> {
  const span = { from: window.from.toISOString(), to: window.to.toISOString() };
  switch (rec.metric.name) {
    case 'funnel_conversion': {
      const funnelId = funnelIdOf(rec);
      if (!funnelId) return null;
      const counts = await ports.funnelCounts(rec.websiteId, funnelId, window.from, window.to);
      if (!counts) return null;
      return { value: rate(counts.completions, counts.entries), numerator: counts.completions, volume: counts.entries, ...span };
    }
    case 'bounce_rate':
    case 'conversion_rate': {
      const t = rec.target;
      const counts = await ports.sessionCounts(rec.websiteId, {
        from: window.from,
        to: window.to,
        page: t.kind === 'page' ? t.ref : null,
        channel: t.kind === 'channel' ? t.ref : null,
        device: t.device ?? null,
        // Bounce needs no conversion event; asking for none skips the lookup.
        event: rec.metric.name === 'bounce_rate' ? null : event,
      });
      if (rec.metric.name === 'bounce_rate') {
        return { value: rate(counts.bounces, counts.sessions), numerator: counts.bounces, volume: counts.sessions, ...span };
      }
      // No recognised conversion event: a rate of zero would read as a real figure, so there is none.
      if (!counts.event) return { value: null, numerator: 0, volume: counts.sessions, ...span, event: null };
      return { value: rate(counts.conversions, counts.sessions), numerator: counts.conversions, volume: counts.sessions, ...span, event: counts.event };
    }
    default:
      return null;
  }
}
