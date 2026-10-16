import { describe, expect, it } from 'vitest';
import { buildStepRows, worstTransition } from '@/features/funnels/format';

const steps = [{ name: 'Home' }, { name: 'Pricing' }, { name: 'Signup' }];

describe('buildStepRows', () => {
  it('works each loss out from the counts, whatever drop_off says', () => {
    // drop_off as the demo reports it (out of a step) — ignored either way.
    const rows = buildStepRows(steps, [
      { step: 1, count: 1000, drop_off: 600 } as never,
      { step: 2, count: 400, drop_off: 300 } as never,
      { step: 3, count: 100 },
    ], 1000);
    expect(rows.map((r) => r.dropOff)).toEqual([0, 600, 300]);
    expect(rows[1]!.stepRate).toBeCloseTo(40);
    expect(rows[2]!.dropOffRate).toBeCloseTo(75);
    expect(rows[2]!.entryRate).toBeCloseTo(10);
    expect(rows[0]!.stepRate).toBeUndefined();
  });

  it('shows a step with no count as zero, not missing', () => {
    const rows = buildStepRows(steps, [{ step: 1, count: 50 }], 50);
    expect(rows[1]!.count).toBe(0);
    expect(rows[1]!.dropOff).toBe(50);
  });
});

describe('worstTransition', () => {
  it('names the transition losing the largest share, not the most people', () => {
    // Home → Pricing loses 600 (60%); Pricing → Signup loses 300 of 400 (75%).
    const rows = buildStepRows(steps, [{ step: 1, count: 1000 }, { step: 2, count: 400 }, { step: 3, count: 100 }], 1000);
    const worst = worstTransition(rows)!;
    expect(worst.from.name).toBe('Pricing');
    expect(worst.to.name).toBe('Signup');
  });

  it('is null when nobody leaves', () => {
    const rows = buildStepRows(steps, [{ step: 1, count: 10 }, { step: 2, count: 10 }, { step: 3, count: 10 }], 10);
    expect(worstTransition(rows)).toBeNull();
  });
});
