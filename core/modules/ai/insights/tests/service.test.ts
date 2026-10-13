import { describe, expect, it } from 'bun:test';
import type { LlmClient } from '../../interfaces/llm-client.interface';
import type { InsightRepository } from '../repository';
import { INSIGHT_DAYS, InsightService, MIN_REFRESH_MS, type InsightDeps } from '../service';
import type { InsightSnapshot, StoredInsight } from '../types';
import { steadySnapshot, troubledSnapshot } from './fixtures';

class MemoryRepo implements InsightRepository {
  rows = new Map<string, StoredInsight & { signals: unknown[] }>();
  saves = 0;
  async get(id: string, date: string) { return this.rows.get(`${id}:${date}`) ?? null; }
  async latest(id: string) { return [...this.rows.values()].filter((r) => r.websiteId === id).sort((a, b) => b.insightDate.localeCompare(a.insightDate))[0] ?? null; }
  async save(i: StoredInsight & { signals: unknown[] }) { this.saves += 1; this.rows.set(`${i.websiteId}:${i.insightDate}`, i); }
  async purgeBefore() { return 0; }
}

const MODEL = { name: 'claude-haiku-5-5', inputCostPerToken: 0.000001, outputCostPerToken: 0.000005 };
const llm = (reply: string | (() => string), tokens = { input: 1800, output: 120 }): LlmClient & { calls: Array<{ system: string; user: string }> } => {
  const calls: Array<{ system: string; user: string }> = [];
  return {
    calls,
    async complete(system, user) {
      calls.push({ system, user });
      const content = typeof reply === 'function' ? reply() : reply;
      return { content, inputTokens: tokens.input, outputTokens: tokens.output };
    },
    async classify() { return ''; },
  };
};

const good = JSON.stringify({ lines: [
  { signal: 'traffic.visitors', kind: 'finding', text: 'Visitors fell 16% over the last 7 days, to 4,300 from 5,100.' },
  { signal: 'device.mobile.conversion', kind: 'action', text: 'Mobile conversion is down 40%: consider an offer for mobile visitors about to leave.' },
]});

function make(over: Partial<Omit<InsightDeps, 'snapshot'>> & { snapshot?: InsightSnapshot } = {}) {
  const repo = new MemoryRepo();
  let clock = new Date('2026-10-13T05:00:00Z');
  const snap = over.snapshot ?? troubledSnapshot();
  const service = new InsightService({
    snapshot: async () => snap, repo, llm: over.llm === undefined ? llm(good) : over.llm, model: over.model === undefined ? MODEL : over.model,
    now: () => clock,
  });
  return { service, repo, advance: (ms: number) => { clock = new Date(clock.getTime() + ms); } };
}

const SITE = troubledSnapshot().websiteId;

describe('InsightService.generate', () => {
  it('words the signals with the model, records tokens and cost, and attaches evidence from the signals', async () => {
    const model = llm(good);
    const { service, repo } = make({ llm: model });
    const { insight, generated } = await service.generate(SITE);
    expect(generated).toBe(true);
    expect(insight).toMatchObject({ status: 'ready', source: 'ai', model: 'claude-haiku-5-5', inputTokens: 1800, outputTokens: 120, insightDate: '2026-10-13' });
    expect(insight.costUsd).toBeCloseTo(1800 * 0.000001 + 120 * 0.000005, 8);
    expect(insight.lines).toHaveLength(2);
    expect(insight.lines[1]).toMatchObject({ kind: 'action', evidence: { kind: 'device' } });
    expect(insight.lines[1]!.action?.prompt).toContain('mobile');
    expect(repo.saves).toBe(1);
    // The model saw the brief, and only the brief.
    expect(model.calls).toHaveLength(1);
    expect(model.calls[0]!.user).toContain('[traffic.visitors] visitors 4,300 (-16%), prev 5,100');
    expect(model.calls[0]!.user).not.toMatch(/@/);
    expect(model.calls[0]!.system).toContain('Use only the figures in the brief');
  });

  it('keeps one insight per site and day: a second call reads it, and does not call the model again', async () => {
    const model = llm(good);
    const { service, repo } = make({ llm: model });
    await service.generate(SITE);
    const again = await service.generate(SITE);
    expect(again.generated).toBe(false);
    expect(model.calls).toHaveLength(1);
    expect(repo.saves).toBe(1);
  });

  it('refuses a forced refresh within six hours, says when, and allows one after', async () => {
    const { service, advance } = make();
    await service.generate(SITE);
    advance(60 * 60 * 1000);
    const early = await service.generate(SITE, { force: true });
    expect(early.generated).toBe(false);
    expect(early.retryAfterMs).toBe(MIN_REFRESH_MS - 60 * 60 * 1000);
    advance(MIN_REFRESH_MS);
    expect((await service.generate(SITE, { force: true })).generated).toBe(true);
  });

  it('says there is not enough data, without calling the model, for a small site', async () => {
    const model = llm(good);
    const small = steadySnapshot({ traffic: { ...steadySnapshot().traffic, visitors: { cur: 40, prev: 35 } } });
    const { service } = make({ llm: model, snapshot: small });
    const { insight } = await service.generate(SITE);
    expect(insight).toMatchObject({ status: 'insufficient_data', lines: [], inputTokens: 0 });
    expect(insight.reason).toContain('Only 40 visitors');
    expect(model.calls).toHaveLength(0);
  });

  it('says nothing changed, without calling the model, for a steady site', async () => {
    const model = llm(good);
    const { service } = make({ llm: model, snapshot: steadySnapshot() });
    const { insight } = await service.generate(SITE);
    expect(insight).toMatchObject({ status: 'ready', lines: [], source: 'rules' });
    expect(insight.reason).toContain('Nothing changed');
    expect(model.calls).toHaveLength(0);
  });

  it('writes the lines from the data when no model is configured', async () => {
    const { service } = make({ llm: null, model: null });
    const { insight } = await service.generate(SITE);
    expect(insight).toMatchObject({ status: 'ready', source: 'rules', model: null, costUsd: 0 });
    expect(insight.lines.length).toBeGreaterThan(0);
    expect(insight.lines.some((l) => l.kind === 'action')).toBe(true);
  });

  it('falls back to the data-written lines when the model fails, and when its wording fails the checks', async () => {
    const down = make({ llm: { async complete() { throw new Error('503'); }, async classify() { return ''; } } });
    const a = (await down.service.generate(SITE)).insight;
    expect(a).toMatchObject({ source: 'rules', status: 'ready' });
    expect(a.reason).toContain('could not be reached');

    const invented = make({ llm: llm(JSON.stringify({ lines: [{ signal: 'traffic.visitors', text: 'Visitors fell 77% over the last 7 days, to 4,300.' }] })) });
    const b = (await invented.service.generate(SITE)).insight;
    // The tokens were spent even though the wording was not used.
    expect(b).toMatchObject({ source: 'rules', inputTokens: 1800 });
    expect(b.reason).toContain('did not pass the checks');
    expect(b.lines.length).toBeGreaterThan(0);
    // The invented "77%" is nowhere in what was stored.
    expect(JSON.stringify(b.lines)).not.toContain('77%');
  });

  it('falls back when the model returns something that is not JSON', async () => {
    const { service } = make({ llm: llm('I cannot help with that.') });
    expect((await service.generate(SITE)).insight.source).toBe('rules');
  });

  it('retries a failed insight on the next call, and does not treat it as done', async () => {
    const { service, repo } = make();
    repo.rows.set(`${SITE}:2026-10-13`, { websiteId: SITE, insightDate: '2026-10-13', status: 'failed', source: 'rules', lines: [], reason: 'x', model: null, inputTokens: 0, outputTokens: 0, costUsd: 0, createdAt: '2026-10-13T00:00:00Z', signals: [] });
    expect((await service.generate(SITE)).generated).toBe(true);
  });
});

describe('InsightService.latest', () => {
  it('reads the stored insight and never calls the model', async () => {
    const model = llm(good);
    const { service } = make({ llm: model });
    expect(await service.latest(SITE)).toBeNull();
    await service.generate(SITE);
    model.calls.length = 0;
    expect((await service.latest(SITE))?.status).toBe('ready');
    expect(model.calls).toHaveLength(0);
  });
});

describe('InsightService.runDaily', () => {
  it('generates for each site, counts what it spent, and survives one site failing', async () => {
    const repo = new MemoryRepo();
    const snaps: Record<string, InsightSnapshot | Error> = {
      a: { ...troubledSnapshot(), websiteId: 'a' }, b: new Error('db down'), c: { ...troubledSnapshot(), websiteId: 'c' },
    };
    const service = new InsightService({
      snapshot: async (id) => { const s = snaps[id]!; if (s instanceof Error) throw s; return s; },
      repo, llm: llm(good), model: MODEL, now: () => new Date('2026-10-13T05:00:00Z'),
    });
    const stats = await service.runDaily(['a', 'b', 'c']);
    expect(stats).toMatchObject({ generated: 2, failed: 1, skipped: 0, tokens: 2 * (1800 + 120) });
    expect(stats.costUsd).toBeGreaterThan(0);
    // A second run the same day skips everyone it finished.
    expect(await service.runDaily(['a', 'c'])).toMatchObject({ generated: 0, skipped: 2 });
  });

  it('uses the same window the snapshot reads', () => {
    expect(INSIGHT_DAYS).toBe(7);
  });
});
