import { sql } from "../../../db";
import type { MetricTotals, MetricWindow, OverviewMetric, SiteMetricSource } from "../../agency/interfaces";

/**
 * Sessions recorded per site over a window, for the agency overview. Counted the same way
 * as the usage report: `sequence = 0` is the per-session meta row, so this is sessions, not
 * chunks.
 */
export class RecordingSiteMetrics implements SiteMetricSource {
  readonly metrics: readonly OverviewMetric[] = ["recordings"];

  async totalsBySite(websiteIds: readonly string[], w: MetricWindow): Promise<Map<string, MetricTotals>> {
    if (websiteIds.length === 0) return new Map();
    const rows = await sql<{ website_id: string; n: number | string }[]>`
      SELECT website_id, COUNT(DISTINCT session_id)::int AS n
      FROM session_replays
      WHERE website_id = ANY(${[...websiteIds]}::text[]) AND sequence = 0
        AND timestamp >= ${w.from}::date AND timestamp < ${w.to}::date + 1
      GROUP BY website_id
    `;
    return new Map(rows.map((r) => [r.website_id, { recordings: Number(r.n) }]));
  }
}
