import { sql } from "../../../db";
import type { UsageCounter, UsageScope } from "../../../platform/usage";

/**
 * Distinct sessions recorded this calendar month.
 *
 * Both identifier forms are matched because `session_replays.website_id` has
 * historically been written as either the short `website_id` or the UUID as text — see
 * the naming note in `interfaces/recording.interface.ts`. Filtering on one form alone
 * undercounts, which for a quota means letting a user past their limit.
 *
 * `sequence = 0` selects the per-session meta row, so this counts sessions rather than
 * chunks.
 */
export class RecordingUsageCounter implements UsageCounter {
  readonly key = "replays";

  async countForUser(scope: UsageScope): Promise<number> {
    const refs = [...scope.websiteIds, ...scope.websiteUuids];
    if (refs.length === 0) return 0;
    const rows = await sql<[{ c: number }]>`
      SELECT COUNT(DISTINCT session_id)::int AS c
      FROM session_replays
      WHERE website_id = ANY(${refs}::text[])
        AND sequence = 0
        AND timestamp >= ${scope.monthStart}
    `;
    return rows[0]?.c ?? 0;
  }
}
