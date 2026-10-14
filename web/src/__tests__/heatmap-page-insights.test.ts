import { describe, expect, it } from 'vitest';
import { heatmapLine, inHeatmapGroup } from '@/features/heatmaps/page-insights';

describe('heatmap page lines', () => {
  it('names what is wrong on a page, in its own numbers', () => {
    const p = { views: 42187, dead_click_pct: 32, reach_half_pct: 61, mobile_avg_scroll: 31, desktop_avg_scroll: 64 };
    expect(heatmapLine(p)).toBe('32% of clicks hit things that do nothing · mobile scrolls 31% vs desktop 64%');
    expect(inHeatmapGroup(p, 'dead_clicks')).toBe(true);
    expect(inHeatmapGroup(p, 'mobile_gap')).toBe(true);
    expect(inHeatmapGroup(p, 'healthy')).toBe(false);
  });

  it('says a page is healthy when nothing stands out', () => {
    const p = { views: 9876, dead_click_pct: 3, reach_half_pct: 92, mobile_avg_scroll: 88, desktop_avg_scroll: 91 };
    expect(heatmapLine(p)).toBe('Healthy — 92% scroll past halfway, 3% dead clicks');
    expect(inHeatmapGroup(p, 'healthy')).toBe(true);
  });

  it('does not judge a page with too few views, or figures it does not have', () => {
    expect(heatmapLine({ views: 40, dead_click_pct: 90 })).toBe('Not enough visits yet to judge');
    expect(inHeatmapGroup({ views: 40, dead_click_pct: 90 }, 'dead_clicks')).toBe(false);
    expect(heatmapLine({ views: 500 })).toBe('Nothing stands out');
  });
});
