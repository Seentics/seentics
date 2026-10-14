import { describe, expect, it } from 'vitest';
import {
  ASK_MAX_LENGTH, askAbout, buildAskAiHref, rangeLabel, readAskParams,
} from '@/features/ai/ask-link';
import { evidenceHref } from '@/features/ai/insights/card-state';
import { parseRefreshResponse } from '@/features/ai/insights/api';

function paramsOf(href: string) {
  return new URL(href, 'https://app.example').searchParams;
}

describe('buildAskAiHref', () => {
  it('points at the AI page with the question and context encoded', () => {
    const href = buildAskAiHref('site-1', 'Where do people drop off in the A & B funnel?', 'A & B funnel');
    expect(href.startsWith('/websites/site-1/ai?')).toBe(true);
    const p = paramsOf(href);
    expect(p.get('q')).toBe('Where do people drop off in the A & B funnel?');
    expect(p.get('ctx')).toBe('A & B funnel');
  });

  it('omits an empty context and clamps the question', () => {
    const href = buildAskAiHref('site-1', 'x'.repeat(ASK_MAX_LENGTH + 50), '  ');
    const p = paramsOf(href);
    expect(p.has('ctx')).toBe(false);
    expect(p.get('q')).toHaveLength(ASK_MAX_LENGTH);
  });

  it('round-trips through readAskParams', () => {
    const { question, context } = askAbout.pages(7);
    expect(readAskParams(paramsOf(buildAskAiHref('site-1', question, context))))
      .toEqual({ q: question, ctx: context });
  });
});

describe('readAskParams', () => {
  it('returns null without a question', () => {
    expect(readAskParams(new URLSearchParams(''))).toBeNull();
    expect(readAskParams(new URLSearchParams('q=%20%20&ctx=Top'))).toBeNull();
    expect(readAskParams(null)).toBeNull();
  });

  it('clamps hand-written values', () => {
    const ask = readAskParams(new URLSearchParams({ q: 'y'.repeat(2000) }));
    expect(ask?.q).toHaveLength(ASK_MAX_LENGTH);
    expect(ask?.ctx).toBeNull();
  });
});

describe('panel questions', () => {
  it('name the range on screen', () => {
    expect(rangeLabel(1)).toBe('24 hours');
    expect(rangeLabel(30)).toBe('30 days');
    expect(rangeLabel(365)).toBe('12 months');
    expect(askAbout.pages(7).question).toBe('Which of my top pages changed the most in the last 7 days, and why?');
    expect(askAbout.traffic(30).question).toBe('Explain my traffic trend over the last 30 days.');
    expect(askAbout.funnel('Checkout').question)
      .toBe('Where do people drop off in the Checkout funnel and what should I fix?');
  });
});

describe('evidenceHref', () => {
  it('links paths under the website and leaves the overview unlinked', () => {
    expect(evidenceHref('site-1', 'funnels/abc')).toBe('/websites/site-1/funnels/abc');
    expect(evidenceHref('site-1', '/replays')).toBe('/websites/site-1/replays');
    expect(evidenceHref('site-1', '')).toBeNull();
  });

  it('refuses anything that could leave the website', () => {
    expect(evidenceHref('site-1', 'javascript:alert(1)')).toBeNull();
    // Leading slashes are stripped, so a protocol-relative path stays under the website.
    expect(evidenceHref('site-1', '//evil.example')).toBe('/websites/site-1/evil.example');
    expect(evidenceHref('site-1', '../other-site')).toBeNull();
    expect(evidenceHref('site-1', 'https://evil.example')).toBeNull();
  });
});

describe('parseRefreshResponse', () => {
  const insight = { date: '2026-10-14', status: 'ready', source: 'ai', reason: null, createdAt: '', lines: [] };

  it('reads a fresh insight', () => {
    expect(parseRefreshResponse({ status: 200, data: { data: insight, refreshed: true, retryAfterSec: 0 }, headers: {} }))
      .toEqual({ kind: 'refreshed', data: insight });
  });

  it('reads a cooldown from the body or Retry-After', () => {
    expect(parseRefreshResponse({ status: 429, data: { retryAfterSec: 120 }, headers: {} }))
      .toMatchObject({ kind: 'cooldown', retryAfterSec: 120 });
    expect(parseRefreshResponse({ status: 429, data: {}, headers: { 'retry-after': '300' } }))
      .toMatchObject({ kind: 'cooldown', retryAfterSec: 300 });
    expect(parseRefreshResponse({ status: 200, data: { data: insight, refreshed: false, retryAfterSec: 30 }, headers: {} }))
      .toEqual({ kind: 'cooldown', data: insight, retryAfterSec: 30 });
  });

  it('reads 403 as a role that cannot refresh', () => {
    expect(parseRefreshResponse({ status: 403, data: {}, headers: {} })).toEqual({ kind: 'forbidden' });
  });
});
