import { sql } from "../../../db";
import type { UsageCounter, UsageScope } from "../../../platform/usage";

/** Funnels the user owns, across all their websites. */
export class FunnelUsageCounter implements UsageCounter {
  readonly key = "funnels";

  async countForUser(scope: UsageScope): Promise<number> {
    const rows = await sql<[{ c: number }]>`
      SELECT COUNT(*)::int AS c
      FROM funnels
      WHERE user_id = ${scope.userId}::uuid
    `;
    return rows[0]?.c ?? 0;
  }
}
