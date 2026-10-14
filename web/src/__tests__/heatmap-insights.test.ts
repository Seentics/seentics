import { describe, expect, it } from 'vitest';
import { ASK_MAX_LENGTH, buildAskAiHref, readAskParams } from '@/features/ai/ask-link';
import {
  askAboutHeatmapPage, deviceLabel, formatRetry, parseRefreshInsights, reachRows, scrollHeadline, targetSummary,
  type ClickTarget, type ScrollStats,
} from '@/features/heatmaps/insights';

const scroll: ScrollStats = {
  page_views: 1200,
  reach: { p25: 92, p50: 61, p75: 30, p100: 9 },
  median_depth: 55,
  avg_depth: 52,
  fold_pct: 22,
  viewport_px: 900,
  document_px: 4100,
  stayed_above_fold_pct: 18,
};

const target = (extra: Partial<ClickTarget> = {}): ClickTarget => ({
  selector: 'a#signup', tag: 'a', role: null, interactive: true, pinned: false,
  clicks: 120, share: 40, depth_pct: 75, reach_pct: 30, above_fold: false, ...extra,
});

describe('scroll summary', () => {
  it('states where half the page views stop and where the fold is', () => {
    expect(scrollHeadline(scroll)).toBe('Half of page views stop by 55% of the page — the fold is at 22%.');
    expect(scrollHeadline({ ...scroll, fold_pct: null })).toBe('Half of page views stop by 55% of the page.');
    expect(scrollHeadline(null)).toBeNull();
  });

  it('lists reach at each quarter', () => {
    expect(reachRows(scroll)).toEqual([
      { depth: 25, pct: 92 }, { depth: 50, pct: 61 }, { depth: 75, pct: 30 }, { depth: 100, pct: 9 },
    ]);
    expect(reachRows(null)).toEqual([]);
  });
});

describe('targetSummary', () => {
  it('gives share, position and reach', () => {
    expect(targetSummary(target())).toBe('40% of clicks · 75% down · 30% reach it');
  });

  it('says a pinned element is always on screen', () => {
    expect(targetSummary(target({ pinned: true, reach_pct: null }))).toBe('40% of clicks · always on screen');
  });

  it('leaves out reach when it is unknown', () => {
    expect(targetSummary(target({ reach_pct: null }))).toBe('40% of clicks · 75% down');
  });
});

describe('formatRetry', () => {
  it('reads the wait in words', () => {
    expect(formatRetry(null)).toBeNull();
    expect(formatRetry(0)).toBeNull();
    expect(formatRetry(30)).toBe('in a minute');
    expect(formatRetry(25 * 60)).toBe('in 25 min');
    expect(formatRetry(2 * 3600)).toBe('in 2 hours');
  });
});

describe('askAboutHeatmapPage', () => {
  it('asks about this page, range and device', () => {
    const { question, context } = askAboutHeatmapPage('https://shop.test/pricing/?utm=x', 30, 'mobile');
    expect(question).toContain('/pricing');
    expect(question).toContain('last 30 days on mobile');
    expect(context).toBe('Heatmap /pricing');
  });

  it('round-trips through the AI link and fits its limit', () => {
    const { question, context } = askAboutHeatmapPage(`/${'very-long-segment/'.repeat(40)}`, 7, 'all');
    const parsed = readAskParams(new URL(buildAskAiHref('site-1', question, context), 'https://app.test').searchParams);
    expect(parsed?.q.length).toBeLessThanOrEqual(ASK_MAX_LENGTH);
    expect(parsed?.ctx?.length).toBeLessThanOrEqual(60);
  });
});

describe('parseRefreshInsights', () => {
  it('treats 403 as a role that cannot refresh', () => {
    expect(parseRefreshInsights({ status: 403, data: { error: 'forbidden' } })).toEqual({ kind: 'forbidden' });
  });

  it('unwraps the refreshed payload', () => {
    const data = { analysis: { page_path: '/p' }, insights: { source: 'ai' }, ai_configured: true };
    expect(parseRefreshInsights({ status: 200, data: { data } })).toEqual({ kind: 'refreshed', data });
  });
});

describe('deviceLabel', () => {
  it('names devices', () => {
    expect(deviceLabel('all')).toBe('All devices');
    expect(deviceLabel('mobile')).toBe('Mobile');
  });
});
