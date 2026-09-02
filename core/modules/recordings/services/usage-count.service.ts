import { sql } from "../../../db";
import type { UsageCounter, UsageScope } from "../../../platform/usage";

/**
 * Distinct sessions recorded this calendar month.
 *
 * One identifier: `scope.websiteIds` and `scope.websiteUuids` are the same list now, so
 * concatenating them only fed every id in twice.
 *
 * `sequence = 0` selects the per-session meta row, so this counts sessions rather than
 * chunks.
 */
export class RecordingUsageCounter implements UsageCounter {
  readonly key = "replays";

  async countForUser(scope: UsageScope): Promise<number> {
    const refs = [...scope.websiteUuids];
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
