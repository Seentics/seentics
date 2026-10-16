import { describe, expect, it } from 'vitest';
import { demoConversionEvents, demoConversionSummary, demoDestinations } from '../conversions';

const all = { destination: '', status: '' as const, kind: '' as const, limit: 1000, offset: 0 };

describe('demo conversions', () => {
  it('has a Meta and a GA4 destination, with this week’s figures from the events', () => {
    const dests = demoDestinations();
    expect(dests.map((d) => d.platform)).toEqual(['meta', 'ga4']);
    for (const d of dests) {
      expect(d.stats.sent_7d).toBeGreaterThan(0);
      expect(d.stats.last_sent_at).not.toBeNull();
    }
  });

  it('has about forty events, newest first, each with a sensible shape', () => {
    const { events, total } = demoConversionEvents(all);
    expect(total).toBeGreaterThanOrEqual(36);
    expect(events.map((e) => e.created_at)).toEqual([...events.map((e) => e.created_at)].sort().reverse());
    for (const e of events) {
      if (e.status === 'skipped') {
        expect(e.error).toMatch(/Not mapped/);
        expect(e.match_keys).toEqual([]);
      }
      if (e.status === 'failed') expect(e.error).toBeTruthy();
      if (e.kind === 'purchase') expect(e.value).not.toBeNull();
    }
    expect(new Set(events.map((e) => e.status))).toEqual(new Set(['success', 'failed', 'skipped']));
  });

  it('skips only what a destination does not map: GA4 leads and the custom event only Meta takes', () => {
    const skipped = demoConversionEvents({ ...all, status: 'skipped' }).events;
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped.every((e) => e.platform === 'ga4' && (e.kind === 'lead' || e.kind === 'custom'))).toBe(true);
  });

  it('filters and pages', () => {
    const meta = demoConversionEvents({ ...all, destination: 'demo-dest-meta' });
    expect(meta.events.every((e) => e.platform === 'meta')).toBe(true);
    expect(demoConversionEvents({ ...all, limit: 5, offset: 5 }).events).toHaveLength(5);
  });

  it('summarises a period: totals add up, a bar per day, match counts within the sent total', () => {
    const s = demoConversionSummary(30);
    expect(s.totals.sent).toBe(s.totals.accepted + s.totals.failed + s.totals.pending);
    expect(s.by_day.length).toBeGreaterThanOrEqual(30);
    expect(s.by_day.reduce((n, d) => n + d.accepted, 0)).toBe(s.totals.accepted);
    for (const k of ['click_id', 'email', 'phone', 'ip_ua', 'browser_id'] as const) expect(s.match[k]).toBeLessThanOrEqual(s.match.total);
    expect(demoConversionSummary(7).totals.sent).toBeLessThan(s.totals.sent);
  });
});
