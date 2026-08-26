import { sql } from "../../../db";
import type { UsageCounter, UsageScope } from "../../../platform/usage";

/**
 * Analytics events recorded this calendar month.
 *
 * `analytics_events.website_id` holds the short `website_id`, not the UUID — the one
 * detail that makes this count wrong if written from outside the module.
 */
export class AnalyticsUsageCounter implements UsageCounter {
  readonly key = "monthly_events";

  async countForUser(scope: UsageScope): Promise<number> {
    if (scope.websiteIds.length === 0) return 0;
    const rows = await sql<[{ c: number }]>`
      SELECT COUNT(*)::int AS c
      FROM analytics_events
      WHERE website_id = ANY(${scope.websiteIds as string[]}::text[])
        AND occurred_at >= ${scope.monthStart}
    `;
    return rows[0]?.c ?? 0;
  }
}
