import { and, eq, gte, sql as dsql } from 'drizzle-orm';
import { aiHeatmapInsights, db } from '../../../db';
import type { HeatmapInsightDevice } from '../../heatmaps/interfaces';
import { isFinding, type HeatmapInsightKey, type HeatmapInsightRepository, type StoredHeatmapInsight } from './repository';

const DEVICES = new Set<HeatmapInsightDevice>(['all', 'desktop', 'tablet', 'mobile']);

/** `HeatmapInsightRepository` over Postgres. The only file in this code that touches `db`. */
export class PostgresHeatmapInsightRepository implements HeatmapInsightRepository {
  private static toStored(row: typeof aiHeatmapInsights.$inferSelect): StoredHeatmapInsight {
    return {
      websiteId: row.websiteId,
      pagePath: row.pagePath,
      device: DEVICES.has(row.device as HeatmapInsightDevice) ? (row.device as HeatmapInsightDevice) : 'all',
      days: row.days,
      source: row.source === 'ai' ? 'ai' : 'rules',
      findings: (row.findings ?? []).filter(isFinding),
      signalKey: row.signalKey,
      reason: row.reason ?? null,
      model: row.model ?? null,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costUsd: Number(row.costUsd),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async get(key: HeatmapInsightKey): Promise<StoredHeatmapInsight | null> {
    const [row] = await db
      .select()
      .from(aiHeatmapInsights)
      .where(dsql`${aiHeatmapInsights.websiteId} = ${key.websiteId}::uuid
        AND ${aiHeatmapInsights.pagePath} = ${key.pagePath}
        AND ${aiHeatmapInsights.device} = ${key.device}
        AND ${aiHeatmapInsights.days} = ${key.days}`)
      .limit(1);
    return row ? PostgresHeatmapInsightRepository.toStored(row) : null;
  }

  async save(insight: StoredHeatmapInsight & { signals: unknown[] }): Promise<void> {
    const values = {
      websiteId: insight.websiteId,
      pagePath: insight.pagePath,
      device: insight.device,
      days: insight.days,
      source: insight.source,
      findings: insight.findings,
      signals: insight.signals,
      signalKey: insight.signalKey,
      reason: insight.reason,
      model: insight.model,
      inputTokens: insight.inputTokens,
      outputTokens: insight.outputTokens,
      costUsd: insight.costUsd.toFixed(6),
    };
    await db
      .insert(aiHeatmapInsights)
      .values(values)
      .onConflictDoUpdate({
        target: [aiHeatmapInsights.websiteId, aiHeatmapInsights.pagePath, aiHeatmapInsights.device, aiHeatmapInsights.days],
        set: { ...values, createdAt: new Date() },
      });
  }

  async countSince(websiteId: string, since: Date): Promise<number> {
    const [row] = await db
      .select({ n: dsql<number>`count(*)::int` })
      .from(aiHeatmapInsights)
      .where(and(eq(aiHeatmapInsights.websiteId, websiteId), gte(aiHeatmapInsights.createdAt, since)));
    return Number(row?.n ?? 0);
  }
}
