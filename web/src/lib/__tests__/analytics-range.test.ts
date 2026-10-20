import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What date range the overview asks the API for.
 *
 * Every preset used to go out as `days`: Today as `days=0` (rejected server-side, so each
 * panel fell back to its own default), Yesterday as `days=1` (which is today), a custom range
 * as "the last N days ending now", and the comparison as twice the range sliced by index.
 */

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/lib/api', () => ({
  default: { get, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { getDailyStats, getDashboardData } from '@/features/analytics/api';
import { customRange, presetRange, previousRange, rangeKey, rangeParams } from '@/features/analytics/range';

const SITE = 'ab12cd34';
// Tuesday 20 October 2026, 09:30 local.
const NOW = new Date(2026, 9, 20, 9, 30);

function requestedParams(): URLSearchParams {
  const url = get.mock.calls.at(-1)![0] as string;
  return new URLSearchParams(url.split('?')[1] ?? '');
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: {} });
});

describe('presetRange', () => {
  it('reads Today as days=0 — since local midnight', () => {
    expect(presetRange(0, NOW)).toEqual({ days: 0 });
  });

  it('reads Yesterday as that whole day, not as days=1 (which is today)', () => {
    expect(presetRange(1, NOW)).toEqual({ days: 1, from: '2026-10-19', to: '2026-10-19' });
  });

  it('leaves the trailing presets as days', () => {
    expect(presetRange(30, NOW)).toEqual({ days: 30 });
  });
});

describe('customRange', () => {
  it('sends the picked dates, both inclusive, rather than "the last N days ending now"', () => {
    expect(customRange(new Date(2026, 8, 1), new Date(2026, 8, 10))).toEqual({ days: 10, from: '2026-09-01', to: '2026-09-10' });
  });

  it('counts a single picked day as one day', () => {
    expect(customRange(new Date(2026, 8, 1), new Date(2026, 8, 1)).days).toBe(1);
  });
});

describe('previousRange', () => {
  it('is the same number of days, ending the day before the range starts', () => {
    expect(previousRange(7, NOW)).toEqual({ days: 7, from: '2026-10-07', to: '2026-10-13' });
    expect(previousRange({ days: 1, from: '2026-10-19', to: '2026-10-19' }, NOW)).toEqual({ days: 1, from: '2026-10-18', to: '2026-10-18' });
  });

  it('compares Today with yesterday', () => {
    expect(previousRange(0, NOW)).toEqual({ days: 1, from: '2026-10-19', to: '2026-10-19' });
  });

  it('asks for a full previous year by its dates — days=730 was past the clamp', () => {
    const prev = previousRange(365, NOW);
    expect(prev).toEqual({ days: 365, from: '2024-10-21', to: '2025-10-20' });
  });
});

describe('request parameters', () => {
  it('sends from/to alongside days', async () => {
    await getDailyStats(SITE, { days: 1, from: '2026-10-19', to: '2026-10-19' }, { country: 'DE' });
    const p = requestedParams();
    expect(p.get('from')).toBe('2026-10-19');
    expect(p.get('to')).toBe('2026-10-19');
    expect(p.get('days')).toBe('1');
    expect(p.get('country')).toBe('DE');
  });

  it('keeps a plain number as days alone', async () => {
    await getDashboardData(SITE, 30);
    const p = requestedParams();
    expect(p.get('days')).toBe('30');
    expect(p.has('from')).toBe(false);
    expect(rangeParams(30)).toEqual({ days: '30' });
  });

  it('keys a dated range apart from the same day count', () => {
    expect(rangeKey(7)).toBe(7);
    expect(rangeKey({ days: 7, from: '2026-10-01', to: '2026-10-07' })).not.toBe(rangeKey(7));
  });
});
