import { desc, eq, lt, sql as dsql } from 'drizzle-orm';
import { aiInsights, db } from '../../../db';
import { isLine, type InsightRepository } from './repository';
import type { InsightStatus, StoredInsight } from './types';

/** `InsightRepository` over Postgres. The only file in the insights code that touches `db`. */
export class PostgresInsightRepository implements InsightRepository {
  private static toStored(row: typeof aiInsights.$inferSelect): StoredInsight {
    return {
      websiteId: row.websiteId,
      insightDate: row.insightDate,
      status: row.status as InsightStatus,
      source: row.source === 'ai' ? 'ai' : 'rules',
      lines: (row.lines ?? []).filter(isLine),
      reason: row.reason ?? null,
      model: row.model ?? null,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costUsd: Number(row.costUsd),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async get(websiteId: string, insightDate: string): Promise<StoredInsight | null> {
    const [row] = await db
      .select()
      .from(aiInsights)
      .where(dsql`${aiInsights.websiteId} = ${websiteId}::uuid AND ${aiInsights.insightDate} = ${insightDate}::date`)
      .limit(1);
    return row ? PostgresInsightRepository.toStored(row) : null;
  }

  async latest(websiteId: string): Promise<StoredInsight | null> {
    const [row] = await db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.websiteId, websiteId))
      .orderBy(desc(aiInsights.insightDate))
      .limit(1);
    return row ? PostgresInsightRepository.toStored(row) : null;
  }

  async save(insight: StoredInsight & { signals: unknown[] }): Promise<void> {
    const values = {
      websiteId: insight.websiteId,
      insightDate: insight.insightDate,
      status: insight.status,
      source: insight.source,
      lines: insight.lines,
      signals: insight.signals,
      reason: insight.reason,
      model: insight.model,
      inputTokens: insight.inputTokens,
      outputTokens: insight.outputTokens,
      costUsd: insight.costUsd.toFixed(6),
    };
    await db
      .insert(aiInsights)
      .values(values)
      .onConflictDoUpdate({ target: [aiInsights.websiteId, aiInsights.insightDate], set: { ...values, createdAt: new Date() } });
  }

  async purgeBefore(cutoff: Date): Promise<number> {
    const deleted = await db.delete(aiInsights).where(lt(aiInsights.createdAt, cutoff)).returning({ id: aiInsights.websiteId });
    return deleted.length;
  }
}
