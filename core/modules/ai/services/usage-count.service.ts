import { sql } from "../../../db";
import type { UsageCounter, UsageScope } from "../../../platform/usage";

/**
 * Successful AI analyses this calendar month.
 *
 * Keyed by user rather than by website: an AI query is billed to the person who ran
 * it, and the daily limit in `ai-query.service.ts` is enforced the same way. Only
 * `status = 'success'` counts — a failed LLM call is not charged.
 */
export class AiUsageCounter implements UsageCounter {
  readonly key = "ai_analyses";

  async countForUser(scope: UsageScope): Promise<number> {
    const rows = await sql<[{ c: number }]>`
      SELECT COUNT(*)::int AS c
      FROM ai_queries
      WHERE user_id = ${scope.userId}::uuid
        AND status = 'success'
        AND created_at >= ${scope.monthStart}
    `;
    return rows[0]?.c ?? 0;
  }
}
