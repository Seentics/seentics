import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { demoAsk, demoConversation, demoConversations, demoSessionFrustration } from '@/lib/demo/ai';
import { aiApi } from '@/features/ai/api';
import { insightsApi } from '@/features/ai/insights/api';
import { alertsApi } from '@/features/ai/alerts/api';
import { recommendationsApi } from '@/features/ai/recommendations/api';
import { heatmapInsightsApi } from '@/features/heatmaps/insights';
import { getSessionAnalysis } from '@/features/replays/analysis';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

afterEach(() => vi.restoreAllMocks());

describe('demo assistant replies', () => {
  it('drafts a change for a set-up request, and never claims it is done', () => {
    const r = demoAsk('Set up an exit-intent popup on /pricing');
    expect(r.proposal?.resource).toBe('automation');
    expect(r.proposal?.summary.lines).toContain('Only on: /pricing');
    expect(r.answer).toMatch(/Nothing changes until you review and confirm/);
  });

  it('answers each topic with its own figures and a next step', () => {
    for (const [q, want] of [
      ['Why is checkout dropping off?', /coupon/i],
      ['Why are mobile visitors struggling on /pricing?', /plan card/i],
      ['Which funnel step loses the most people?', /Pricing View → Signup Start/],
      ['Is anything broken?', /coupons\/apply/],
      ['Show me frustrated recordings', /frustrated/i],
      ['How are we doing?', /12,340 visitors/],
    ] as const) {
      const r = demoAsk(q);
      expect(r.answer, q).toMatch(want);
      expect(r.answer, q).toMatch(/Next/);
      expect(r.proposal, q).toBeNull();
    }
  });

  it('answers the prompts the demo itself links to with the matching story, not a draft', async () => {
    const { demoDailyInsight, demoRecommendations, demoAlerts } = await import('@/lib/demo/ai');
    const prompts = [
      ...demoDailyInsight().lines.flatMap((l) => (l.action ? [l.action.prompt] : [])),
      ...demoRecommendations().map((r) => r.prompt).filter(Boolean),
      ...demoAlerts().alerts.map((a) => a.askPrompt),
    ];
    expect(prompts.length).toBeGreaterThan(4);
    for (const p of prompts) {
      expect(demoAsk(p).proposal, p).toBeNull();
    }
    expect(demoAsk(prompts[0]!).answer).toMatch(/plan card/i);
  });

  it('has threads that reopen with their history', () => {
    for (const t of demoConversations()) expect(demoConversation(t.id)).toHaveLength(1);
    expect(demoConversation('unknown')).toEqual([]);
  });

  it('gives the replay list a spread of frustration scores', () => {
    const scores = Array.from({ length: 8 }, (_, i) => demoSessionFrustration(i).frustrationScore);
    expect(scores.some((s) => s >= 30)).toBe(true);
    expect(scores.some((s) => s < 30)).toBe(true);
  });
});

describe('demo mode makes no AI requests', () => {
  it('answers every AI read from fixtures', async () => {
    const get = vi.spyOn(api, 'get');
    const post = vi.spyOn(api, 'post');
    expect((await aiApi.conversations('demo')).length).toBeGreaterThan(0);
    expect((await insightsApi.today('demo'))?.lines.length).toBeGreaterThan(0);
    expect((await alertsApi.list('demo', 'open')).alerts.every((a) => a.status === 'open')).toBe(true);
    expect((await recommendationsApi.list('demo', ['open'])).every((r) => r.status === 'open')).toBe(true);
    expect((await heatmapInsightsApi.get('demo', '/pricing', 30, 'all')).insights.findings.length).toBe(3);
    expect((await getSessionAnalysis('demo', 'demo-session-1', true)).summary?.outcome).toBe('abandoned');
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('refuses to apply a demo draft, saying why', async () => {
    const post = vi.spyOn(api, 'post');
    await expect(aiApi.confirm('demo', 'demo-query-1')).rejects.toThrow(/Demo mode/);
    expect(post).not.toHaveBeenCalled();
  });
});
