import { describe, expect, it } from 'bun:test';
import { analysePage, type ClickRow, type ScrollRow } from '../../../heatmaps/lib/heatmap-insights';
import type { HeatmapPageAnalysis } from '../../../heatmaps/interfaces';
import type { LlmClient } from '../../interfaces/llm-client.interface';
import { buildHeatmapBrief } from '../brief';
import { parseHeatmapOutput, withRuleTopUp } from '../output';
import type { HeatmapInsightKey, HeatmapInsightRepository, StoredHeatmapInsight } from '../repository';
import {
  DAILY_CAP_REASON,
  FRESH_MS,
  HeatmapInsightService,
  MODEL_UNREACHABLE_REASON,
  OUTPUT_REJECTED_REASON,
  REFRESH_COOLDOWN_MS,
} from '../service';

/** A page with a buried sign-up link, a dead hero image, and mobile visitors who stop early. */
function fixture(path = '/pricing'): HeatmapPageAnalysis {
  const s = (device: string, depth: number, views: number, fold: number): ScrollRow => ({ device, depth, views, fold, viewportPx: 900, documentPx: 3600 });
  const c = (device: string, selector: string, tag: string, y: number, clicks: number): ClickRow => ({
    device, selector, band: Math.min(9, Math.floor(y / 1000)), clicks, yWeighted: y * clicks, tag, role: null, annotated: false, pinned: false,
  });
  return analysePage({
    pagePath: path,
    days: 30,
    device: 'all',
    scrollRows: [s('desktop', 25, 40, 25), s('desktop', 50, 30, 25), s('desktop', 75, 20, 25), s('desktop', 100, 10, 25), s('mobile', 15, 60, 15), s('mobile', 30, 30, 15), s('mobile', 100, 10, 15)],
    clickRows: [c('desktop', 'a#signup', 'a', 7500, 40), c('desktop', 'div.hero-image', 'div', 1500, 25), c('desktop', 'button#menu', 'button', 300, 35), c('mobile', 'div.hero-image', 'div', 1200, 20)],
  });
}

const A = fixture();
const ids = A.signals.map((s) => s.id);
const cta = A.signals.find((s) => s.kind === 'cta_reach')!;
const dead = A.signals.find((s) => s.kind === 'dead_clicks')!;

describe('buildHeatmapBrief', () => {
  it('lists the signals by id with their facts', () => {
    const b = buildHeatmapBrief(A);
    for (const id of ids.slice(0, 8)) expect(b.text).toContain(`[${id}]`);
    expect(b.text).toContain('a#signup');
    expect(b.text).toContain('not measured: rage clicks');
    expect(b.numbers.has('30')).toBe(true);
  });

  it('masks ids and emails in the path and selectors', () => {
    const a = fixture('/users/ada@example.com/orders/88421337');
    a.signals = a.signals.map((s) => ({ ...s, facts: `${s.facts} div#user-ada@example.com` }));
    const b = buildHeatmapBrief(a);
    expect(b.text).not.toContain('ada@example.com');
    expect(b.text).not.toContain('88421337');
  });
});

describe('parseHeatmapOutput', () => {
  const brief = buildHeatmapBrief(A);
  const json = (findings: unknown[]) => JSON.stringify({ findings });

  it('keeps findings that cite known signals with figures from the brief', () => {
    const { findings, dropped } = parseHeatmapOutput(json([
      { signal: cta.id, finding: 'Only 30% of page views reach the a#signup link, which sits 75% down the page.', fix: 'Move a#signup into the first screen.' },
      { signal: dead.id, finding: `${dead.facts.match(/= (\d+)%/)![1]}% of clicks land on div.hero-image, which is not a link.`, fix: 'Make the hero image a link to the sign-up page.' },
    ]), A.signals, brief.numbers);
    expect(dropped).toEqual([]);
    expect(findings.map((f) => f.signal)).toEqual([cta.id, dead.id]);
    expect(findings[0]).toMatchObject({ kind: 'cta_reach', device: cta.device });
  });

  it('drops invented numbers, unknown or repeated signals and personal data, one finding at a time', () => {
    const { findings, dropped } = parseHeatmapOutput(json([
      { signal: cta.id, finding: 'Only 12% of page views reach the sign-up link at the bottom.', fix: 'Move it up.' + ' Higher.' },
      { signal: 'made-up', finding: 'Visitors love the page very much indeed.', fix: 'Keep it as it is.' },
      { signal: dead.id, finding: 'Clicks on the hero image come from ada@example.com mostly.', fix: 'Make the hero image clickable.' },
      { signal: cta.id, finding: 'The sign-up link sits far down the page for most.', fix: 'Repeat it near the top.' },
      { signal: cta.id, finding: 'The sign-up link is buried below where most stop.', fix: 'Repeat it near the top.' },
      'not an object',
    ]), A.signals, brief.numbers);
    expect(findings.map((f) => f.finding)).toEqual(['The sign-up link sits far down the page for most.']);
    expect(dropped.map((d) => d.why)).toEqual([
      'numbers not in the data: 12',
      'unknown signal',
      'looks like personal data',
      'signal used twice',
      'malformed finding',
    ]);
  });

  it('refuses output with no findings envelope', () => {
    expect(() => parseHeatmapOutput('I cannot help with that.', A.signals, brief.numbers)).toThrow();
  });

  it('tops a thin answer up from the rules', () => {
    const one = [{ signal: cta.id, kind: cta.kind, device: cta.device, finding: 'x'.repeat(20), fix: 'y'.repeat(10) }];
    const topped = withRuleTopUp(one, A.signals);
    expect(topped).toHaveLength(2);
    expect(topped[1]!.signal).not.toBe(cta.id);
  });
});

class MemoryRepo implements HeatmapInsightRepository {
  rows = new Map<string, StoredHeatmapInsight & { signals: unknown[] }>();
  saves = 0;
  count = 0;
  private k = (key: HeatmapInsightKey) => `${key.websiteId}|${key.pagePath}|${key.device}|${key.days}`;
  async get(key: HeatmapInsightKey) { return this.rows.get(this.k(key)) ?? null; }
  async save(i: StoredHeatmapInsight & { signals: unknown[] }) { this.saves += 1; this.count += 1; this.rows.set(this.k(i), i); }
  async countSince() { return this.count; }
}

function llm(reply: () => string): LlmClient & { calls: number } {
  const client = {
    calls: 0,
    async complete() { client.calls += 1; return { content: reply(), inputTokens: 900, outputTokens: 250 }; },
    async classify() { return ''; },
  };
  return client;
}

const GOOD = () => JSON.stringify({ findings: [
  { signal: cta.id, finding: 'Only 30% of page views reach the sign-up link, 75% down the page.', fix: 'Move a#signup into the first screen.' },
  { signal: dead.id, finding: 'Many clicks land on div.hero-image, which does nothing.', fix: 'Make the hero image a link.' },
] });

const MODEL = { name: 'claude-haiku-5-5', inputCostPerToken: 0.0000001, outputCostPerToken: 0.0000005 };

function service(opts: { reply?: () => string; fail?: boolean; cap?: number; at?: { t: number } } = {}) {
  const repo = new MemoryRepo();
  const clock = opts.at ?? { t: Date.parse('2026-10-14T10:00:00Z') };
  const client = llm(opts.fail ? () => { throw new Error('down'); } : (opts.reply ?? GOOD));
  const svc = new HeatmapInsightService({ repo, llm: client, model: MODEL, dailyCap: opts.cap, now: () => new Date(clock.t) });
  return { svc, repo, client, clock };
}

describe('HeatmapInsightService', () => {
  it('words a page once and serves the stored wording after', async () => {
    const { svc, repo, client } = service();
    const first = await svc.narrate('w1', A);
    expect(first.source).toBe('ai');
    expect(first.findings.map((f) => f.signal)).toEqual([cta.id, dead.id]);
    expect(first.retry_after_sec).toBe(REFRESH_COOLDOWN_MS / 1000);
    const again = await svc.narrate('w1', A);
    expect(again.findings).toEqual(first.findings);
    expect(client.calls).toBe(1);
    expect(repo.saves).toBe(1);
    const row = [...repo.rows.values()][0]!;
    expect(row.costUsd).toBeCloseTo(900 * 0.0000001 + 250 * 0.0000005, 9);
    expect(row.signals.length).toBeGreaterThan(0);
  });

  it('shares one model call between simultaneous requests', async () => {
    const { svc, client } = service();
    await Promise.all([svc.narrate('w1', A), svc.narrate('w1', A)]);
    expect(client.calls).toBe(1);
  });

  it('rewords once the wording is a day old', async () => {
    const { svc, client, clock } = service();
    await svc.narrate('w1', A);
    clock.t += FRESH_MS + 1;
    await svc.narrate('w1', A);
    expect(client.calls).toBe(2);
  });

  it('refuses a refresh inside the cooldown and says how long is left', async () => {
    const { svc, client, clock } = service();
    await svc.narrate('w1', A);
    clock.t += 10 * 60 * 1000;
    const r = await svc.narrate('w1', A, { refresh: true });
    expect(client.calls).toBe(1);
    expect(r.retry_after_sec).toBe(50 * 60);
    clock.t += 50 * 60 * 1000;
    await svc.narrate('w1', A, { refresh: true });
    expect(client.calls).toBe(2);
  });

  it('falls back to the rules when the model is down, and retries sooner', async () => {
    const { svc, client, clock } = service({ fail: true });
    const r = await svc.narrate('w1', A);
    expect(r.source).toBe('rules');
    expect(r.reason).toBe(MODEL_UNREACHABLE_REASON);
    expect(r.findings.length).toBeGreaterThan(0);
    clock.t += 16 * 60 * 1000;
    await svc.narrate('w1', A);
    expect(client.calls).toBe(2);
  });

  it('falls back to the rules when nothing the model wrote passes', async () => {
    const { svc } = service({ reply: () => JSON.stringify({ findings: [{ signal: cta.id, finding: 'Only 3.14159% reach it, sadly enough.', fix: 'Move it.' + ' Up.' }] }) });
    const r = await svc.narrate('w1', A);
    expect(r.source).toBe('rules');
    expect(r.reason).toBe(OUTPUT_REJECTED_REASON);
    expect(r.findings[0]!.finding).toBe(A.signals[0]!.finding);
  });

  it('stops calling the model at the daily cap', async () => {
    const { svc, client, repo } = service({ cap: 0 });
    const r = await svc.narrate('w1', A);
    expect(client.calls).toBe(0);
    expect(repo.saves).toBe(0);
    expect(r).toMatchObject({ source: 'rules', reason: DAILY_CAP_REASON });
  });

  it('calls nothing for a page without enough data, or without a model', async () => {
    const quiet = analysePage({ pagePath: '/q', days: 30, device: 'all', scrollRows: [], clickRows: [] });
    const { svc, client } = service();
    const r = await svc.narrate('w1', quiet);
    expect(r.findings).toEqual([]);
    expect(r.reason).toContain('Only 0 page views');
    expect(client.calls).toBe(0);

    const none = new HeatmapInsightService({ repo: new MemoryRepo(), llm: null, model: null });
    expect(none.configured).toBe(false);
    expect((await none.narrate('w1', A)).source).toBe('rules');
  });
});
