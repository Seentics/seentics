import { sql } from "../../../db";
import type { UsageCounter, UsageScope } from "../../../platform/usage";

/**
 * Distinct heatmap pages across the user's websites.
 *
 * Counts `(website_id, page_path)` pairs, not points — a page with ten thousand
 * recorded cells is one page for quota purposes.
 *
 * `heatmap_points.website_id` is the UUID, so this takes `websiteUuids`. The original
 * inlined `SELECT id FROM websites WHERE user_id = …` as a subquery here.
 */
export class HeatmapUsageCounter implements UsageCounter {
  readonly key = "heatmaps";

  async countForUser(scope: UsageScope): Promise<number> {
    if (scope.websiteUuids.length === 0) return 0;
    const rows = await sql<[{ c: number }]>`
      SELECT COUNT(*)::int AS c
      FROM (
        SELECT DISTINCT website_id, page_path
        FROM heatmap_points
        WHERE website_id = ANY(${scope.websiteUuids as string[]}::uuid[])
      ) sub
    `;
    return rows[0]?.c ?? 0;
  }
}
