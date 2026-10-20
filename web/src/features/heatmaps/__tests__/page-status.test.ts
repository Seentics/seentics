import { describe, expect, it } from 'vitest';
import { pageName, pageSignals, pageStatus } from '@/features/heatmaps/page-insights';

const page = (over: Record<string, unknown>) => ({
  views: 500, dead_click_pct: 5, reach_half_pct: 70, mobile_avg_scroll: 60, desktop_avg_scroll: 65, ...over,
});

describe('pageStatus', () => {
  it('names the most pressing problem, or healthy', () => {
    expect(pageStatus(page({ dead_click_pct: 30, reach_half_pct: 30 }))).toBe('dead_clicks');
    expect(pageStatus(page({ reach_half_pct: 30 }))).toBe('low_scroll');
    expect(pageStatus(page({ mobile_avg_scroll: 30, desktop_avg_scroll: 70 }))).toBe('mobile_gap');
    expect(pageStatus(page({ views: 20 }))).toBe('too_little');
    expect(pageStatus(page({}))).toBe('healthy');
  });
});

describe('pageSignals', () => {
  it('lists every problem a page has, most pressing first', () => {
    expect(pageSignals(page({ dead_click_pct: 30, mobile_avg_scroll: 30, desktop_avg_scroll: 70 }))).toEqual(['dead_clicks', 'mobile_gap']);
    expect(pageSignals(page({ dead_click_pct: 30, reach_half_pct: 30 }))).toEqual(['dead_clicks', 'low_scroll']);
  });

  it('is Healthy with none, and Not enough data alone', () => {
    expect(pageSignals(page({}))).toEqual(['healthy']);
    expect(pageSignals(page({ views: 20, dead_click_pct: 30 }))).toEqual(['too_little']);
  });
});

describe('pageName', () => {
  it('reads a path as a name', () => {
    expect(pageName('/')).toBe('Home');
    expect(pageName('/pricing')).toBe('Pricing');
    expect(pageName('/blog/why-real-time-matters')).toBe('Why real time matters');
  });
});
