import { and, asc, desc, eq, gte, inArray, lt, sql as dsql } from 'drizzle-orm';
import { aiHeatmapInsights, aiRecommendations, db } from '../../../db';
import { isFinding } from '../heatmap-insights/repository';
import type { RecommendationRepository } from './repository';
import {
  RECOMMENDATION_SOURCES,
  isRecommendationStatus,
  type MetricValue,
  type Recommendation,
  type RecommendationSource,
  type RecommendationTarget,
  type ResourceRef,
  type StoredImpact,
  type TargetMetric,
} from './types';

type Row = typeof aiRecommendations.$inferSelect;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** `RecommendationRepository` over Postgres. The only file in the recommendations code that touches `db`. */
export class PostgresRecommendationRepository implements RecommendationRepository {
  static toRecommendation(row: Row): Recommendation {
    const source = (RECOMMENDATION_SOURCES as readonly string[]).includes(row.source)
      ? (row.source as RecommendationSource)
      : 'assistant';
    const target = (row.target ?? {}) as Partial<RecommendationTarget>;
    const metric = (row.metric ?? {}) as Partial<TargetMetric>;
    return {
      id: row.id,
      websiteId: row.websiteId,
      source,
      sourceRef: row.sourceRef ?? null,
      dedupeKey: row.dedupeKey,
      title: row.title,
      rationale: row.rationale,
      prompt: row.prompt,
      target: {
        kind: target.kind ?? 'site',
        ref: target.ref ?? null,
        label: target.label ?? '',
        ...(target.device ? { device: target.device } : {}),
      },
      metric: { name: metric.name ?? 'none', windowDays: metric.windowDays ?? 14 },
      status: isRecommendationStatus(row.status) ? row.status : 'open',
      baseline: (row.baseline as MetricValue | null) ?? null,
      appliedAt: iso(row.appliedAt),
      appliedBy: row.appliedBy ?? null,
      appliedVia: row.appliedVia === 'proposal' || row.appliedVia === 'manual' ? row.appliedVia : null,
      resource: (row.resource as ResourceRef | null) ?? null,
      queryId: row.queryId ?? null,
      impact: (row.impact as StoredImpact | null) ?? null,
      lastSeenAt: row.lastSeenAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async upsertCandidates(
    websiteId: string,
    candidates: Parameters<RecommendationRepository['upsertCandidates']>[1],
    opts: { now: Date; dismissedBefore: Date },
  ) {
    let inserted = 0;
    let refreshed = 0;
    for (const c of candidates) {
      const values = {
        websiteId,
        source: c.source,
        sourceRef: c.sourceRef,
        dedupeKey: c.dedupeKey,
        title: c.title,
        rationale: c.rationale,
        prompt: c.prompt,
        target: c.target as unknown as Record<string, unknown>,
        metric: c.metric as unknown as Record<string, unknown>,
        status: 'open',
        lastSeenAt: opts.now,
        createdAt: opts.now,
        updatedAt: opts.now,
      };
      const rows = await db
        .insert(aiRecommendations)
        .values(values)
        .onConflictDoUpdate({
          target: [aiRecommendations.websiteId, aiRecommendations.dedupeKey],
          set: {
            sourceRef: values.sourceRef,
            title: values.title,
            rationale: values.rationale,
            prompt: values.prompt,
            target: values.target,
            metric: values.metric,
            lastSeenAt: opts.now,
            status: 'open',
            // An open row keeps its place in the list; one coming back from expired or dismissed is new again.
            updatedAt: dsql`CASE WHEN ${aiRecommendations.status} = 'open' THEN ${aiRecommendations.updatedAt} ELSE ${opts.now} END`,
          },
          // Applied, measuring and measured rows are history: a source suggesting the same thing again
          // does not reopen them. A dismissal holds for a quiet period, then may come back.
          setWhere: dsql`${aiRecommendations.status} IN ('open', 'expired')
            OR (${aiRecommendations.status} = 'dismissed' AND ${aiRecommendations.updatedAt} < ${opts.dismissedBefore})`,
        })
        .returning({ inserted: dsql<boolean>`(xmax = 0)` });
      if (rows[0]?.inserted) inserted++;
      else if (rows.length) refreshed++;
    }
    return { inserted, refreshed };
  }

  async expireStale(cutoff: Date): Promise<number> {
    const rows = await db
      .update(aiRecommendations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(eq(aiRecommendations.status, 'open'), lt(aiRecommendations.lastSeenAt, cutoff)))
      .returning({ id: aiRecommendations.id });
    return rows.length;
  }

  async list(websiteId: string, opts: { statuses?: string[]; limit: number }): Promise<Recommendation[]> {
    const rows = await db
      .select()
      .from(aiRecommendations)
      .where(and(
        eq(aiRecommendations.websiteId, websiteId),
        opts.statuses?.length ? inArray(aiRecommendations.status, opts.statuses) : undefined,
      ))
      .orderBy(desc(aiRecommendations.updatedAt))
      .limit(Math.min(Math.max(opts.limit, 1), 200));
    return rows.map(PostgresRecommendationRepository.toRecommendation);
  }

  async get(websiteId: string, id: string): Promise<Recommendation | null> {
    const [row] = await db
      .select()
      .from(aiRecommendations)
      .where(and(eq(aiRecommendations.id, id), eq(aiRecommendations.websiteId, websiteId)))
      .limit(1);
    return row ? PostgresRecommendationRepository.toRecommendation(row) : null;
  }

  async transition(websiteId: string, id: string, from: string[], to: string, at: Date): Promise<Recommendation | null> {
    const [row] = await db
      .update(aiRecommendations)
      .set({ status: to, updatedAt: at })
      .where(and(
        eq(aiRecommendations.id, id),
        eq(aiRecommendations.websiteId, websiteId),
        inArray(aiRecommendations.status, from),
      ))
      .returning();
    return row ? PostgresRecommendationRepository.toRecommendation(row) : null;
  }

  async markApplied(input: Parameters<RecommendationRepository['markApplied']>[0]): Promise<Recommendation | null> {
    const [row] = await db
      .update(aiRecommendations)
      .set({
        status: 'applied',
        appliedAt: input.at,
        appliedBy: input.userId,
        appliedVia: input.via,
        resource: input.resource as unknown as Record<string, unknown> | null,
        queryId: input.queryId,
        updatedAt: input.at,
      })
      .where(and(
        eq(aiRecommendations.id, input.id),
        eq(aiRecommendations.websiteId, input.websiteId),
        // The claim: only one request moves a row out of `open`.
        inArray(aiRecommendations.status, ['open', 'expired']),
      ))
      .returning();
    return row ? PostgresRecommendationRepository.toRecommendation(row) : null;
  }

  async insertApplied(input: Parameters<RecommendationRepository['insertApplied']>[0]): Promise<Recommendation | null> {
    const [row] = await db
      .insert(aiRecommendations)
      .values({
        websiteId: input.websiteId,
        source: input.source,
        sourceRef: input.sourceRef,
        dedupeKey: input.dedupeKey,
        title: input.title,
        rationale: input.rationale,
        prompt: '',
        target: input.target as unknown as Record<string, unknown>,
        metric: input.metric as unknown as Record<string, unknown>,
        status: 'applied',
        appliedAt: input.at,
        appliedBy: input.userId,
        appliedVia: 'proposal',
        resource: input.resource as unknown as Record<string, unknown> | null,
        queryId: input.queryId,
        lastSeenAt: input.at,
        createdAt: input.at,
        updatedAt: input.at,
      })
      // One row per confirmed draft: the key carries the query id, so a retry adds nothing.
      .onConflictDoNothing({ target: [aiRecommendations.websiteId, aiRecommendations.dedupeKey] })
      .returning();
    return row ? PostgresRecommendationRepository.toRecommendation(row) : null;
  }

  async saveBaseline(id: string, baseline: MetricValue | null, at: Date): Promise<void> {
    await db
      .update(aiRecommendations)
      .set({ baseline: baseline as unknown as Record<string, unknown> | null, status: 'measuring', updatedAt: at })
      .where(and(eq(aiRecommendations.id, id), inArray(aiRecommendations.status, ['applied', 'measuring'])));
  }

  async saveImpact(id: string, impact: StoredImpact, status: string, at: Date): Promise<void> {
    await db
      .update(aiRecommendations)
      .set({ impact: impact as unknown as Record<string, unknown>, status, updatedAt: at })
      .where(and(eq(aiRecommendations.id, id), inArray(aiRecommendations.status, ['applied', 'measuring'])));
  }

  async listToMeasure(limit: number): Promise<Recommendation[]> {
    const rows = await db
      .select()
      .from(aiRecommendations)
      .where(inArray(aiRecommendations.status, ['applied', 'measuring']))
      .orderBy(asc(aiRecommendations.appliedAt))
      .limit(Math.max(1, limit));
    return rows.map(PostgresRecommendationRepository.toRecommendation);
  }

  async recentHeatmapFindings(websiteId: string, since: Date) {
    const rows = await db
      .select({ pagePath: aiHeatmapInsights.pagePath, device: aiHeatmapInsights.device, findings: aiHeatmapInsights.findings })
      .from(aiHeatmapInsights)
      .where(and(eq(aiHeatmapInsights.websiteId, websiteId), gte(aiHeatmapInsights.createdAt, since)))
      .orderBy(desc(aiHeatmapInsights.createdAt))
      .limit(50);
    return rows.map((r) => ({ pagePath: r.pagePath, device: r.device, findings: (r.findings ?? []).filter(isFinding) }));
  }
}
