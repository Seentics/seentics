import type { RecommendationRepository } from '../repository';
import type { ImpactPorts } from '../metrics';
import type { Recommendation, RecommendationCandidate } from '../types';

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

/** `RecommendationRepository` in memory, with the same conditional transitions as the SQL. */
export class MemoryRecommendationRepo implements RecommendationRepository {
  rows: Recommendation[] = [];
  heatmaps: Array<{ pagePath: string; device: string; findings: any[] }> = [];

  async upsertCandidates(websiteId: string, candidates: RecommendationCandidate[], opts: { now: Date; dismissedBefore: Date }) {
    let inserted = 0;
    let refreshed = 0;
    for (const c of candidates) {
      const existing = this.rows.find((r) => r.websiteId === websiteId && r.dedupeKey === c.dedupeKey);
      const now = opts.now.toISOString();
      if (!existing) {
        this.rows.push({
          id: uuid(), websiteId, source: c.source, sourceRef: c.sourceRef, dedupeKey: c.dedupeKey, title: c.title,
          rationale: c.rationale, prompt: c.prompt, target: c.target, metric: c.metric, status: 'open', baseline: null,
          appliedAt: null, appliedBy: null, appliedVia: null, resource: null, queryId: null, impact: null,
          lastSeenAt: now, createdAt: now, updatedAt: now,
        });
        inserted++;
        continue;
      }
      const reopen = existing.status === 'open' || existing.status === 'expired'
        || (existing.status === 'dismissed' && new Date(existing.updatedAt) < opts.dismissedBefore);
      if (!reopen) continue;
      Object.assign(existing, {
        title: c.title, rationale: c.rationale, prompt: c.prompt, target: c.target, metric: c.metric, sourceRef: c.sourceRef,
        lastSeenAt: now, updatedAt: existing.status === 'open' ? existing.updatedAt : now, status: 'open',
      });
      refreshed++;
    }
    return { inserted, refreshed };
  }

  async expireStale(cutoff: Date) {
    let n = 0;
    for (const r of this.rows) {
      if (r.status === 'open' && new Date(r.lastSeenAt) < cutoff) { r.status = 'expired'; n++; }
    }
    return n;
  }

  async list(websiteId: string, opts: { statuses?: string[]; limit: number }) {
    return this.rows
      .filter((r) => r.websiteId === websiteId && (!opts.statuses?.length || opts.statuses.includes(r.status)))
      .slice(0, opts.limit)
      .map((r) => ({ ...r }));
  }

  async get(websiteId: string, id: string) {
    const r = this.rows.find((x) => x.websiteId === websiteId && x.id === id);
    return r ? { ...r } : null;
  }

  async transition(websiteId: string, id: string, from: string[], to: any, at: Date) {
    const r = this.rows.find((x) => x.websiteId === websiteId && x.id === id && from.includes(x.status));
    if (!r) return null;
    r.status = to;
    r.updatedAt = at.toISOString();
    return { ...r };
  }

  async markApplied(input: Parameters<RecommendationRepository['markApplied']>[0]) {
    const r = this.rows.find((x) => x.websiteId === input.websiteId && x.id === input.id && (x.status === 'open' || x.status === 'expired'));
    if (!r) return null;
    Object.assign(r, {
      status: 'applied', appliedAt: input.at.toISOString(), appliedBy: input.userId, appliedVia: input.via,
      resource: input.resource, queryId: input.queryId, updatedAt: input.at.toISOString(),
    });
    return { ...r };
  }

  async insertApplied(input: Parameters<RecommendationRepository['insertApplied']>[0]) {
    if (this.rows.some((x) => x.websiteId === input.websiteId && x.dedupeKey === input.dedupeKey)) return null;
    const at = input.at.toISOString();
    const row: Recommendation = {
      id: uuid(), websiteId: input.websiteId, source: input.source, sourceRef: input.sourceRef, dedupeKey: input.dedupeKey,
      title: input.title, rationale: input.rationale, prompt: '', target: input.target, metric: input.metric, status: 'applied',
      baseline: null, appliedAt: at, appliedBy: input.userId, appliedVia: 'proposal', resource: input.resource,
      queryId: input.queryId, impact: null, lastSeenAt: at, createdAt: at, updatedAt: at,
    };
    this.rows.push(row);
    return { ...row };
  }

  async saveBaseline(id: string, baseline: any, at: Date) {
    const r = this.rows.find((x) => x.id === id && (x.status === 'applied' || x.status === 'measuring'));
    if (r) Object.assign(r, { baseline, status: 'measuring', updatedAt: at.toISOString() });
  }

  async saveImpact(id: string, impact: any, status: any, at: Date) {
    const r = this.rows.find((x) => x.id === id && (x.status === 'applied' || x.status === 'measuring'));
    if (r) Object.assign(r, { impact, status, updatedAt: at.toISOString() });
  }

  async listToMeasure(limit: number) {
    return this.rows.filter((r) => r.status === 'applied' || r.status === 'measuring').slice(0, limit).map((r) => ({ ...r }));
  }

  async recentHeatmapFindings() {
    return this.heatmaps;
  }
}

/** Ports answering from fixed counts per window start, so a test states before and after directly. */
export function fakePorts(counts: {
  sessions?: (q: { from: Date; to: Date; page?: string | null }) => { sessions: number; bounces: number; conversions: number; event: string | null };
  funnel?: (from: Date, to: Date) => { entries: number; completions: number } | null;
  automation?: { totalExecutions: number; successCount: number; failureCount: number; last30Days: number } | null;
}): ImpactPorts & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async sessionCounts(websiteId, q) {
      calls.push(['sessions', websiteId, q]);
      return counts.sessions?.(q) ?? { sessions: 0, bounces: 0, conversions: 0, event: null };
    },
    async funnelCounts(websiteId, funnelId, from, to) {
      calls.push(['funnel', websiteId, funnelId]);
      return counts.funnel?.(from, to) ?? null;
    },
    async automationActivity(_w, automationId) {
      return counts.automation ? { automationId, ...counts.automation } : null;
    },
  };
}
