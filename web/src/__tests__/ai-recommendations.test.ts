import { describe, expect, it } from 'vitest';
import { buildAskAiHref, readAskParams } from '@/features/ai/ask-link';
import {
  beforeAfter, doItHref, groupRecommendations, impactHighlight, impactTone, measuringLabel,
} from '@/features/ai/recommendations/helpers';
import type { ImpactReport, Recommendation } from '@/features/ai/recommendations/types';
import { appliedNote } from '@/components/ai/ProposalCard';

const REC = '33333333-3333-4333-8333-333333333333';

const report = (over: Partial<ImpactReport> = {}): ImpactReport => ({
  recommendationId: REC,
  status: 'not_applied',
  target: { kind: 'page', ref: '/pricing', label: '/pricing' },
  metric: { name: 'bounce_rate', windowDays: 14 },
  appliedAt: null,
  baseline: null,
  checkpoints: [],
  verdict: null,
  headline: 'Fix the fold on /pricing',
  sentence: '',
  sentenceSource: 'rules',
  automation: null,
  caveats: ['seasonality'],
  nextCheckAt: null,
  ...over,
});

const rec = (over: Partial<Recommendation> = {}): Recommendation => ({
  id: REC,
  source: 'heatmap',
  title: 'Fix the fold on /pricing',
  rationale: 'Most visitors never scroll past the hero.',
  prompt: 'The heatmap for /pricing shows people stop early. Draft a banner.',
  target: { kind: 'page', ref: '/pricing', label: '/pricing' },
  metric: { name: 'bounce_rate', windowDays: 14 },
  status: 'open',
  appliedAt: null,
  appliedVia: null,
  resource: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  report: report(),
  ...over,
});

const measured = (id: string, verdict: ImpactReport['verdict'], measuredAt: string): Recommendation => rec({
  id,
  status: 'measured',
  appliedAt: '2026-09-01T00:00:00Z',
  report: report({
    status: 'measured',
    verdict,
    baseline: { value: 52, numerator: 1040, volume: 2000, from: '', to: '' },
    checkpoints: [{
      day: 14, measuredAt, after: { value: 46, numerator: 460, volume: 1000, from: '', to: '' },
      verdict: verdict ?? 'no_change', deltaPts: -6, z: -3, automation: null,
    }],
    headline: `Your change on /pricing: bounce rate −6 pts after 14 days (52% → 46%) [${id}]`,
  }),
});

describe('recommendation links', () => {
  it('"Do it" opens the assistant with the prompt and carries the recommendation id', () => {
    const href = doItHref('site-1', rec())!;
    const params = new URL(href, 'https://app.example').searchParams;
    expect(href.startsWith('/websites/site-1/ai?')).toBe(true);
    expect(readAskParams(params)).toEqual({ q: rec().prompt, ctx: 'Fix the fold on /pricing', rec: REC });
  });

  it('has no "Do it" for a row without a prompt', () => {
    expect(doItHref('site-1', rec({ prompt: '  ' }))).toBeNull();
  });

  it('drops a rec param that is not an id', () => {
    const href = buildAskAiHref('site-1', 'q', 'ctx', 'not-an-id');
    expect(new URL(href, 'https://x').searchParams.has('rec')).toBe(false);
    expect(readAskParams(new URLSearchParams({ q: 'q', rec: "1' or 1=1" }))).toEqual({ q: 'q', ctx: null });
  });
});

describe('grouping and impact', () => {
  it('splits open, measuring and measured', () => {
    const g = groupRecommendations([
      rec({ id: 'a' }),
      rec({ id: 'b', status: 'measuring', appliedAt: '2026-10-02T00:00:00Z' }),
      rec({ id: 'c', status: 'applied', appliedAt: '2026-10-03T00:00:00Z' }),
      measured('d', 'improved', '2026-10-10T00:00:00Z'),
    ]);
    expect(g.open.map((r) => r.id)).toEqual(['a']);
    expect(g.measuring.map((r) => r.id)).toEqual(['c', 'b']);
    expect(g.measured.map((r) => r.id)).toEqual(['d']);
  });

  it('formats before and after with a real minus sign', () => {
    expect(beforeAfter(measured('d', 'improved', '').report)).toEqual({ before: '52%', after: '46%', delta: '−6 pts' });
    expect(beforeAfter(report())).toBeNull();
  });

  it('colours only real moves', () => {
    expect(impactTone('improved')).toBe('good');
    expect(impactTone('worse')).toBe('bad');
    expect(impactTone('too_little_data')).toBe('neutral');
  });

  it('highlights the newest reading that says something, never a too-little-data one', () => {
    const list = [
      measured('old', 'improved', '2026-10-01T00:00:00Z'),
      measured('new', 'no_change', '2026-10-09T00:00:00Z'),
      measured('thin', 'too_little_data', '2026-10-12T00:00:00Z'),
    ];
    expect(impactHighlight(list)?.id).toBe('new');
    expect(impactHighlight([measured('thin', 'too_little_data', '2026-10-12T00:00:00Z')])).toBeNull();
  });

  it('says when the next reading is due', () => {
    expect(measuringLabel(report({ status: 'too_early', nextCheckAt: '2026-10-08T12:00:00Z' }))).toMatch(/^Measuring · first reading /);
    expect(measuringLabel(report({ nextCheckAt: null }))).toBe('Measuring…');
  });
});

describe('proposal card', () => {
  it('says what happens next for each kind of draft', () => {
    expect(appliedNote('funnel')).toContain('Funnels');
    expect(appliedNote('goal')).toContain('goals');
    expect(appliedNote('automation')).toContain('inactive');
  });
});
