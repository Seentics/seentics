import { sql } from "../../../db";
import type { UsageCounter, UsageScope } from "../../../platform/usage";

/** Automations the user owns. */
export class AutomationUsageCounter implements UsageCounter {
  readonly key = "automations";

  async countForUser(scope: UsageScope): Promise<number> {
    const rows = await sql<[{ c: number }]>`
      SELECT COUNT(*)::int AS c
      FROM automations
      WHERE user_id = ${scope.userId}::uuid
    `;
    return rows[0]?.c ?? 0;
  }
}
