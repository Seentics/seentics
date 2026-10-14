import { describe, expect, it } from 'bun:test';
import { THRESHOLDS, change, detectSignals, isTrafficCollapse } from '../signals';
import { steadySnapshot, troubledSnapshot } from './fixtures';

const ids = (s: ReturnType<typeof detectSignals>) => s.map((x) => x.id);

describe('change', () => {
  it('is the relative change, and null with nothing before', () => {
    expect(change({ cur: 75, prev: 100 })).toBe(-0.25);
    expect(change({ cur: 5, prev: 0 })).toBeNull();
  });
});

describe('detectSignals', () => {
  it('says nothing about a steady site', () => {
    expect(detectSignals(steadySnapshot())).toEqual([]);
  });

  it('finds what changed in a troubled week, most important first', () => {
    const signals = detectSignals(troubledSnapshot());
    const got = ids(signals);
    expect(got).toContain('traffic.visitors');
    expect(got).toContain('traffic.bounce');
    expect(got).toContain('conversion.purchase');
    expect(got).toContain('device.mobile.conversion');
    expect(got.some((id) => id.startsWith('error.'))).toBe(true);
    expect(got).toContain('channel.instagram.engaged');
    // Ranked by score.
    expect(signals.map((s) => s.score)).toEqual([...signals.map((s) => s.score)].sort((a, b) => b - a));
    expect(signals.length).toBeLessThanOrEqual(THRESHOLDS.maxSignals);
  });

  it('gives every signal an id the brief can quote: no spaces or brackets, even for an error message or a channel name', () => {
    const odd = troubledSnapshot();
    odd.channels[0]!.name = 'Hacker News [front page]';
    for (const s of detectSignals(odd)) expect(s.id).toMatch(/^[a-z0-9./_-]+$/);
  });

  it('words each signal from its numbers, with evidence, and offers an action for a fall on a device', () => {
    const mobile = detectSignals(troubledSnapshot()).find((s) => s.id === 'device.mobile.conversion')!;
    expect(mobile.text).toContain('Mobile conversion fell');
    expect(mobile.evidence.kind).toBe('device');
    expect(mobile.action?.prompt).toContain('mobile');
    const visitors = detectSignals(troubledSnapshot()).find((s) => s.id === 'traffic.visitors')!;
    expect(visitors.text).toBe('Visitors fell 16% over the last 7 days: 4,300 against 5,100 in the 7 days before.');
    expect(visitors.brief).toBe('visitors 4,300 (-16%), prev 5,100');
  });

  it('ignores a percentage with too little behind it', () => {
    const tiny = steadySnapshot({ traffic: { ...steadySnapshot().traffic, visitors: { cur: 30, prev: 60 } } });
    expect(ids(detectSignals(tiny))).not.toContain('traffic.visitors');
    const fewConversions = steadySnapshot({ conversion: { event: 'signup', count: { cur: 3, prev: 9 } } });
    expect(ids(detectSignals(fewConversions))).not.toContain('conversion.signup');
  });

  it('does not flag a small movement, and treats the threshold as inclusive', () => {
    const small = steadySnapshot({ traffic: { ...steadySnapshot().traffic, visitors: { cur: 5300, prev: 5000 } } });
    expect(ids(detectSignals(small))).not.toContain('traffic.visitors');
    const exact = steadySnapshot({ traffic: { ...steadySnapshot().traffic, visitors: { cur: 115, prev: 100 } } });
    expect(ids(detectSignals(exact))).toContain('traffic.visitors');
  });

  it('only offers an action for something that fell, never for growth', () => {
    const growth = steadySnapshot({
      devices: [{ name: 'Mobile', sessions: { cur: 2400, prev: 2400 }, bounceRate: { cur: 40, prev: 40 }, conversions: { cur: 120, prev: 60 } }],
    });
    const device = detectSignals(growth).find((s) => s.id === 'device.mobile.conversion')!;
    expect(device.text).toContain('rose');
    expect(device.action).toBeUndefined();
  });

  it('does not reach into a segment too small to be meaningful', () => {
    const small = steadySnapshot({
      devices: [{ name: 'Tablet', sessions: { cur: 40, prev: 60 }, bounceRate: { cur: 60, prev: 40 }, conversions: { cur: 0, prev: 6 } }],
    });
    expect(ids(detectSignals(small)).some((id) => id.startsWith('device.'))).toBe(false);
  });

  it('flags a sharp traffic drop as possibly broken tracking, instead of the ordinary visitors line', () => {
    const collapsed = steadySnapshot({ traffic: { ...steadySnapshot().traffic, visitors: { cur: 40, prev: 5000 } } });
    const signals = detectSignals(collapsed);
    expect(signals[0]!.id).toBe('traffic.collapse');
    expect(signals[0]!.text).toContain('Traffic dropped sharply');
    expect(signals[0]!.text).toContain('tracking may be broken');
    expect(signals[0]!.brief).toContain('visitors 40 (-99%), prev 5,000');
    expect(ids(signals)).not.toContain('traffic.visitors');
    // Just short of the threshold is an ordinary fall.
    const fall = steadySnapshot({ traffic: { ...steadySnapshot().traffic, visitors: { cur: 1600, prev: 5000 } } });
    expect(isTrafficCollapse({ cur: 1600, prev: 5000 })).toBe(false);
    expect(ids(detectSignals(fall))).toContain('traffic.visitors');
    expect(ids(detectSignals(fall))).not.toContain('traffic.collapse');
    // Too little before to call it a collapse.
    expect(isTrafficCollapse({ cur: 0, prev: THRESHOLDS.minVisitors - 1 })).toBe(false);
    expect(isTrafficCollapse({ cur: 0, prev: THRESHOLDS.minVisitors })).toBe(true);
  });

  it('words an error count as occurrences in the window, and a count-less new error without a figure', () => {
    const counted = detectSignals(steadySnapshot({ errors: [{ message: 'TypeError: boom', page: '/checkout', count: 84, isNew: false }] }));
    const e = counted.find((s) => s.kind === 'error')!;
    expect(e.text).toBe('An error happened 84 times on /checkout over the last 7 days: TypeError: boom');
    expect(e.brief).toContain('84 times in the last 7 days');

    const rare = detectSignals(steadySnapshot({ errors: [{ message: 'TypeError: boom', page: '/checkout', count: 3, isNew: true }] }));
    expect(rare.some((s) => s.kind === 'error')).toBe(false);

    const uncounted = detectSignals(steadySnapshot({ errors: [
      { message: 'TypeError: old', page: '/a', count: null, isNew: false },
      { message: 'TypeError: new', page: '/b', count: null, isNew: true },
    ] }));
    const only = uncounted.filter((s) => s.kind === 'error');
    expect(only).toHaveLength(1);
    expect(only[0]!.text).toBe('A new error appeared on /b in the last 7 days: TypeError: new');
    expect(only[0]!.text).not.toMatch(/\d+ times/);
  });
});
