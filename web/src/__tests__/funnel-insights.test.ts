import { describe, expect, it } from 'vitest';
import { funnelLine, inFunnelGroup, previousFrom } from '@/features/funnels/insights';

const funnel = { id: 'f', name: 'Signup', is_active: true, steps: [{ name: 'Home' }, { name: 'Pricing' }, { name: 'Signup' }] } as never;
const report = (starts: number, conv: number, steps?: Array<[number, number, number]>) => ({
  total_starts: starts, total_conversions: conv, conversion_rate: (conv / starts) * 100,
  step_metrics: steps?.map(([step, count, rate]) => ({ step, count, drop_off: 0, drop_off_rate: rate })),
}) as never;

describe('funnel lines', () => {
  it('says the rate, where most people leave, and the trend', () => {
    const a = report(1000, 50, [[1, 1000, 40], [2, 600, 92], [3, 50, 0]]);
    expect(funnelLine(funnel, a, { starts: 1000, conversions: 80 }))
      .toBe('Converts 5.0% (50 of 1,000) · most leave at Pricing → Signup (92%) · down from 8.0%');
  });

  it('works out the period before from a report over twice the period', () => {
    expect(previousFrom(report(1000, 50), report(2400, 130))).toEqual({ starts: 1400, conversions: 80 });
  });

  it('does not judge a funnel with too little traffic', () => {
    const a = report(40, 2);
    expect(funnelLine(funnel, a, { starts: 40, conversions: 10 })).toMatch(/too few entries to judge$/);
    expect(inFunnelGroup(funnel, a, { starts: 40, conversions: 10 }, 'worse')).toBe(false);
    expect(inFunnelGroup(funnel, a, null, 'low_traffic')).toBe(true);
  });

  it('flags a big leak and ignores noise in the trend', () => {
    const a = report(1000, 50, [[1, 1000, 40], [2, 600, 92], [3, 50, 0]]);
    expect(inFunnelGroup(funnel, a, null, 'leak')).toBe(true);
    expect(inFunnelGroup(funnel, a, { starts: 1000, conversions: 52 }, 'worse')).toBe(false);
  });
});
