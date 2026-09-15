import { describe, expect, it } from 'vitest';
import { scrollReachPoints } from '@/features/heatmaps/preview-math';

describe('scrollReachPoints', () => {
  it('calculates cumulative reach from one final depth per page view', () => {
    const rows = scrollReachPoints([
      { nx: 0, ny: 0.25, intensity: 2 },
      { nx: 0, ny: 0.75, intensity: 1 },
      { nx: 0, ny: 1, intensity: 1 },
    ], 4);
    expect(rows.map(p => [p.ny, p.intensity])).toEqual([
      [0, 4], [0.25, 4], [0.5, 2], [0.75, 2], [1, 1],
    ]);
  });
});
