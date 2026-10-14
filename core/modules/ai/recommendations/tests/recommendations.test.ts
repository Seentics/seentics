import { describe, expect, it } from 'bun:test';
import { fromHeatmaps, fromInsight, fromSessions, MAX_PROMPT } from '../collector';
import { buildReport, dueCheckpoints, formatDelta, headlineFor, judge, twoProportionZ } from '../impact';
import { acceptSentence, createImpactNarrator } from '../narration';
import { assistantTarget, RecommendationService } from '../service';
import type { MetricValue, Recommendation } from '../types';
import { MemoryRecommendationRepo, fakePorts } from './fakes';

const SITE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DAY = 86_400_000;

const insightOn = (date: string, pct: number) => ({
  insightDate: date,
  status: 'ready',
  lines: [
    { kind: 'finding' as const, text: 'Visitors rose 20%.', evidence: { kind: 'traffic' as const, label: 'Traffic' } },
    {
      kind: 'action' as const,
      text: `Mobile conversion fell ${pct}%.`,
      evidence: { kind: 'device' as const, label: 'Mobile sessions' },
      action: {
        title: 'Recover mobile conversions',
        prompt: `Mobile visitors are converting ${pct}% less than before. Draft an automation.`,
        target: { kind: 'site' as const, ref: null, device: 'mobile' },
      },
    },
  ],
});

const value = (v: number, numerator: number, volume: number): MetricValue => ({ value: v, numerator, volume, from: '', to: '' });

describe('collector', () => {
  it('keys an insight action by what it is about, not by the day\'s figures', () => {
    const a = fromInsight(insightOn('2026-10-01', 31));
    const b = fromInsight(insightOn('2026-10-02', 28));
    expect(a).toHaveLength(1);
    expect(a[0]!.dedupeKey).toBe(b[0]!.dedupeKey);
    expect(a[0]!.target).toEqual({ kind: 'site', ref: null, label: 'Mobile visitors', device: 'mobile' });
    expect(a[0]!.metric.name).toBe('conversion_rate');
    // Findings are not recommendations.
    expect(a.every((c) => c.source === 'insight')).toBe(true);
  });

  it('targets the page an error alert is about', () => {
    const [c] = fromInsight({
      insightDate: '2026-10-01',
      lines: [{
        kind: 'action', text: 'Errors on /checkout.', evidence: { kind: 'error', label: 'Errors' },
        action: { title: 'Get alerted about errors', prompt: 'Draft a webhook for errors on /checkout.', target: { kind: 'page', ref: '/checkout' } },
      }],
    });
    expect(c!.target).toEqual({ kind: 'page', ref: '/checkout', label: '/checkout' });
    expect(c!.metric.name).toBe('none');
  });

  it('takes heatmap fixes once per page and kind, preferring the all-devices wording', () => {
    const finding = (kind: string, signal: string) => ({ signal, kind, device: 'all', finding: `Finding about ${kind} here.`, fix: 'Move the button up.' });
    const out = fromHeatmaps([
      { pagePath: '/pricing', device: 'mobile', findings: [finding('fold', 'fold-mobile') as any] },
      { pagePath: '/pricing', device: 'all', findings: [finding('fold', 'fold-all') as any, finding('dead_clicks', 'dead-all') as any, finding('cta_reach', 'cta-all-1') as any] },
    ]);
    // Two per page, and the mobile row's `fold` is the same suggestion as the all row's.
    expect(out.map((c) => c.dedupeKey)).toEqual(['heatmap|/pricing|fold', 'heatmap|/pricing|dead_clicks']);
    expect(out[0]!.sourceRef).toBe('/pricing:fold-all');
    expect(out[0]!.target.kind).toBe('page');
    expect(out[0]!.prompt.length).toBeLessThanOrEqual(MAX_PROMPT);
  });

  it('needs several frustrated sessions on one entry page', () => {
    const row = (entryPage: string, counts: Record<string, number>) => ({
      sessionId: 's', startedAt: '', score: 10, counts, device: 'desktop', browser: '', country: '', entryPage,
      durationSeconds: 1, pagesViewed: 1, summary: null, outcome: null,
    });
    const out = fromSessions([
      row('/checkout', { rage_click: 3 }), row('/checkout', { rage_click: 1, dead_click: 1 }), row('/checkout', { dead_click: 1 }),
      row('/blog', { rage_click: 5 }), row('/blog', { rage_click: 5 }),
    ] as any, 7);
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe('Fix rage clicks on /checkout');
    expect(out[0]!.dedupeKey).toBe('session|/checkout|rage_click');
    expect(out[0]!.rationale).toContain('3 recorded sessions');
  });
});

describe('impact', () => {
  it('reports an improvement beyond normal variation', () => {
    // Bounce 52% -> 46% on thousands of sessions: lower is better.
    const r = judge('bounce_rate', value(52, 1040, 2000), value(46, 460, 1000));
    expect(r.verdict).toBe('improved');
    expect(r.deltaPts).toBe(-6);
    expect(r.z).toBeLessThan(-1.96);
  });

  it('reports a move the wrong way', () => {
    expect(judge('conversion_rate', value(5, 100, 2000), value(3, 30, 1000)).verdict).toBe('worse');
  });

  it('calls a small move on modest traffic no change', () => {
    const r = judge('bounce_rate', value(50, 100, 200), value(46, 46, 100));
    expect(r.verdict).toBe('no_change');
    expect(r.deltaPts).toBe(-4);
  });

  it('refuses to judge too little traffic', () => {
    expect(judge('bounce_rate', value(50, 500, 1000), value(20, 8, 40)).verdict).toBe('too_little_data');
    expect(judge('funnel_conversion', value(10, 2, 20), value(50, 10, 20)).verdict).toBe('too_little_data');
  });

  it('says when there is nothing to compare with', () => {
    expect(judge('bounce_rate', null, value(40, 40, 100)).verdict).toBe('no_baseline');
    expect(judge('conversion_rate', { ...value(0, 0, 500), value: null }, value(4, 20, 500)).verdict).toBe('no_baseline');
    expect(judge('none', null, null).verdict).toBe('not_measurable');
  });

  it('computes a two-proportion z', () => {
    expect(twoProportionZ(50, 100, 50, 100)).toBe(0);
    expect(twoProportionZ(0, 100, 0, 100)).toBeNull();
  });

  it('formats deltas with a real minus sign', () => {
    expect(formatDelta(-6)).toBe('−6 pts');
    expect(formatDelta(1.5)).toBe('+1.5 pts');
  });

  it('takes checkpoints only once due', () => {
    const appliedAt = new Date('2026-10-01T00:00:00Z');
    const rec = { appliedAt: appliedAt.toISOString(), impact: null };
    expect(dueCheckpoints(rec, new Date(appliedAt.getTime() + 6 * DAY))).toEqual([]);
    expect(dueCheckpoints(rec, new Date(appliedAt.getTime() + 7 * DAY + 3 * 3600_000))).toEqual([7]);
    expect(dueCheckpoints(rec, new Date(appliedAt.getTime() + 20 * DAY))).toEqual([7, 14]);
  });

  it('writes the headline the dashboard shows', () => {
    const h = headlineFor(
      { target: { kind: 'page', ref: '/pricing', label: '/pricing' }, resource: null, metric: { name: 'bounce_rate', windowDays: 14 } },
      value(52, 520, 1000),
      { day: 14, measuredAt: '', after: value(46, 460, 1000), verdict: 'improved', deltaPts: -6, z: -2.7, automation: null },
    );
    expect(h).toBe('Your change on /pricing: bounce rate −6 pts after 14 days (52% → 46%)');
  });
});

describe('narration', () => {
  const facts = { headline: 'Your change on /pricing: bounce rate −6 pts after 14 days (52% → 46%)', verdict: 'improved' as const, extra: [] };

  it('keeps a sentence whose numbers are all in the facts', () => {
    expect(acceptSentence('Bounce rate on /pricing fell from 52% to 46% in the 14 days after your change.', facts)).toBe(true);
  });

  it('drops invented numbers and causal claims', () => {
    expect(acceptSentence('Bounce rate on /pricing fell from 52% to 41% after your change.', facts)).toBe(false);
    expect(acceptSentence('Bounce rate on /pricing fell to 46% because of your change.', facts)).toBe(false);
  });

  it('falls back to the rule sentence when the model fails or wanders', async () => {
    const bad = createImpactNarrator({ complete: async () => ({ content: '{"sentence":"It fell 99 points."}', inputTokens: 1, outputTokens: 1 }), classify: async () => '' });
    expect(await bad.word(facts)).toEqual({ sentence: `${facts.headline}. That is beyond normal variation for this much traffic.`, source: 'rules' });
    const good = createImpactNarrator({ complete: async () => ({ content: '{"sentence":"Bounce on /pricing went from 52% to 46% over the 14 days after the change."}', inputTokens: 1, outputTokens: 1 }), classify: async () => '' });
    expect((await good.word(facts)).source).toBe('ai');
    const none = createImpactNarrator(null);
    expect((await none.word(facts)).source).toBe('rules');
  });
});

function service(opts: { now: Date; repo?: MemoryRecommendationRepo; ports?: ReturnType<typeof fakePorts>; insight?: any; sessions?: any[] }) {
  const repo = opts.repo ?? new MemoryRecommendationRepo();
  let now = opts.now;
  const svc = new RecommendationService({
    repo,
    ports: opts.ports ?? fakePorts({}),
    sources: {
      latestInsight: async () => opts.insight ?? null,
      frustratedSessions: async () => opts.sessions ?? [],
    },
    narrator: createImpactNarrator(null),
    now: () => now,
  });
  return { svc, repo, setNow: (d: Date) => { now = d; } };
}

describe('RecommendationService', () => {
  it('dedupes repeated daily runs into one row and expires it once no longer suggested', async () => {
    const t0 = new Date('2026-10-02T06:00:00Z');
    const { svc, repo, setNow } = service({ now: t0, insight: insightOn('2026-10-02', 31) });
    expect(await svc.runDaily([SITE])).toMatchObject({ inserted: 1, refreshed: 0 });
    setNow(new Date(t0.getTime() + DAY));
    expect(await svc.runDaily([SITE])).toMatchObject({ inserted: 0, refreshed: 1 });
    expect(repo.rows).toHaveLength(1);

    // The source stops suggesting it (the insight is now too old to collect from): 14 days later it expires.
    setNow(new Date(t0.getTime() + 16 * DAY));
    const stats = await svc.runDaily([SITE]);
    expect(stats.expired).toBe(1);
    expect(repo.rows[0]!.status).toBe('expired');
  });

  it('does not reopen a dismissed suggestion inside the quiet period', async () => {
    const t0 = new Date('2026-10-02T06:00:00Z');
    const { svc, repo, setNow } = service({ now: t0, insight: insightOn('2026-10-02', 31) });
    await svc.collect(SITE);
    await svc.dismiss(SITE, repo.rows[0]!.id);
    setNow(new Date(t0.getTime() + DAY));
    await svc.collect(SITE);
    expect(repo.rows[0]!.status).toBe('dismissed');
  });

  it('links a confirmed draft to the recommendation it came from', async () => {
    const now = new Date('2026-10-02T06:00:00Z');
    const { svc, repo } = service({ now, insight: insightOn('2026-10-02', 31) });
    await svc.collect(SITE);
    const rec = repo.rows[0]!;
    const row = await svc.recordApplied({
      websiteId: SITE, userId: 'u1', queryId: 'q1', recommendationId: rec.id,
      operation: 'create', proposal: { resource: 'automation', payload: {} }, created: { resource: 'automation', id: 'a1' },
    });
    expect(row?.id).toBe(rec.id);
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({ appliedVia: 'proposal', resource: { resource: 'automation', id: 'a1' }, queryId: 'q1' });
    expect(repo.rows[0]!.appliedAt).toBe(now.toISOString());
  });

  it('links a confirmed change to its recommendation, but records no row of its own for one', async () => {
    const now = new Date('2026-10-02T06:00:00Z');
    const { svc, repo } = service({ now, insight: insightOn('2026-10-02', 31) });
    await svc.collect(SITE);
    const rec = repo.rows[0]!;
    // Not tied to a recommendation: a change to something that existed is not measured on its own.
    expect(await svc.recordApplied({
      websiteId: SITE, userId: 'u1', queryId: 'q7', recommendationId: null, operation: 'set_status',
      proposal: { resource: 'automation', payload: { active: true } }, created: { resource: 'automation', id: 'a1' },
    })).toBeNull();
    expect(repo.rows).toHaveLength(1);
    const row = await svc.recordApplied({
      websiteId: SITE, userId: 'u1', queryId: 'q8', recommendationId: rec.id, operation: 'update',
      proposal: { resource: 'funnel', payload: {} }, created: { resource: 'funnel', id: 'f1' },
    });
    expect(row?.id).toBe(rec.id);
    expect(repo.rows[0]).toMatchObject({ appliedVia: 'proposal', resource: { resource: 'funnel', id: 'f1' } });
  });

  it('records its own row when the recommendation is not open on this site', async () => {
    const now = new Date('2026-10-02T06:00:00Z');
    const { svc, repo } = service({ now, insight: insightOn('2026-10-02', 31) });
    await svc.collect(OTHER);
    const foreign = repo.rows[0]!;
    await svc.recordApplied({
      websiteId: SITE, userId: 'u1', queryId: 'q2', recommendationId: foreign.id,
      operation: 'create', proposal: { resource: 'funnel', payload: {}, summary: { title: 'Checkout' } }, created: { resource: 'funnel', id: 'f1' },
    });
    // The other site's row is untouched; this site has an assistant row measuring the new funnel.
    expect(foreign.status).toBe('open');
    const mine = repo.rows.find((r) => r.websiteId === SITE)!;
    expect(mine).toMatchObject({ source: 'assistant', dedupeKey: 'assistant|q2', target: { kind: 'funnel', ref: 'f1', label: 'Checkout' } });
    expect(mine.metric.name).toBe('funnel_conversion');
  });

  it('marks "I did this myself" applied with nothing created, once', async () => {
    const now = new Date('2026-10-02T06:00:00Z');
    const { svc, repo } = service({ now, insight: insightOn('2026-10-02', 31) });
    await svc.collect(SITE);
    const id = repo.rows[0]!.id;
    expect((await svc.markDone(SITE, id, 'u1'))?.appliedVia).toBe('manual');
    expect(await svc.markDone(SITE, id, 'u1')).toBeNull();
    expect(await svc.dismiss(SITE, id)).toBeNull();
  });

  it('measures before and after: too early, then improved at 7 and 14 days', async () => {
    const applied = new Date('2026-10-01T00:00:00Z');
    const ports = fakePorts({
      // Before the change: 52% of 2,000 sessions bounced. After: 46% of 1,000.
      sessions: (q) => (q.from < applied ? { sessions: 2000, bounces: 1040, conversions: 0, event: null } : { sessions: 1000, bounces: 460, conversions: 0, event: null }),
    });
    const { svc, repo, setNow } = service({ now: applied, ports });
    await repo.upsertCandidates(SITE, [{
      source: 'heatmap', sourceRef: '/pricing:fold-all', dedupeKey: 'heatmap|/pricing|fold', title: 'Fold', rationale: 'r', prompt: 'p',
      target: { kind: 'page', ref: '/pricing', label: '/pricing' }, metric: { name: 'bounce_rate', windowDays: 14 },
    }], { now: applied, dismissedBefore: applied });
    const id = repo.rows[0]!.id;
    await svc.markDone(SITE, id, 'u1');
    await svc.captureBaseline((await repo.get(SITE, id))!);
    expect(repo.rows[0]!.baseline).toMatchObject({ value: 52, volume: 2000 });
    // The page narrows the read to sessions that entered there.
    expect((ports.calls[0] as any)[2].page).toBe('/pricing');

    setNow(new Date(applied.getTime() + 3 * DAY));
    expect((await svc.get(SITE, id))!.report.status).toBe('too_early');

    setNow(new Date(applied.getTime() + 8 * DAY));
    await svc.measureDue();
    let report = (await svc.get(SITE, id))!.report;
    expect(report.status).toBe('measuring');
    expect(report.verdict).toBe('improved');

    setNow(new Date(applied.getTime() + 15 * DAY));
    await svc.measureDue();
    report = (await svc.get(SITE, id))!.report;
    expect(repo.rows[0]!.status).toBe('measured');
    expect(report.status).toBe('measured');
    expect(report.headline).toBe('Your change on /pricing: bounce rate −6 pts after 14 days (52% → 46%)');
    expect(report.caveats[0]).toContain('seasonality');
  });

  it('reports too little data honestly, and an automation\'s own runs', async () => {
    const applied = new Date('2026-10-01T00:00:00Z');
    const ports = fakePorts({
      sessions: () => ({ sessions: 40, bounces: 10, conversions: 2, event: 'signup' }),
      automation: { totalExecutions: 0, successCount: 0, failureCount: 0, last30Days: 0 },
    });
    const { svc, repo, setNow } = service({ now: applied, ports });
    await svc.recordApplied({
      websiteId: SITE, userId: 'u1', queryId: 'q9', recommendationId: null,
      operation: 'create', proposal: { resource: 'automation', payload: {}, summary: { title: 'Exit offer' } }, created: { resource: 'automation', id: 'a9' },
    });
    await new Promise((r) => setTimeout(r, 0));
    setNow(new Date(applied.getTime() + 8 * DAY));
    await svc.measureDue();
    const report = (await svc.get(SITE, repo.rows[0]!.id))!.report;
    expect(report.verdict).toBe('too_little_data');
    expect(report.headline).toContain('too little traffic to tell');
    expect(report.automation?.totalExecutions).toBe(0);
  });

  it('picks what an assistant-only change is measured by', () => {
    expect(assistantTarget({ created: { resource: 'goal', id: 'g' }, proposal: { resource: 'goal', payload: {} } }).metric.name).toBe('none');
    expect(assistantTarget({ created: { resource: 'automation', id: 'a' }, proposal: { resource: 'automation', payload: {} } }).metric.name).toBe('conversion_rate');
  });

  it('builds a not-applied report from the suggestion itself', () => {
    const rec = { id: 'x', title: 'T', rationale: 'R', status: 'open', appliedAt: null, impact: null, target: { kind: 'site', ref: null, label: '' }, metric: { name: 'none', windowDays: 14 }, baseline: null } as unknown as Recommendation;
    expect(buildReport(rec, new Date()).status).toBe('not_applied');
  });
});
