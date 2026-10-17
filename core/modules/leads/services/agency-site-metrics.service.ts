import { sql } from "../../../db";
import type { MetricTotals, MetricWindow, OverviewMetric, SiteMetricSource } from "../../agency/interfaces";

/** Form submissions stored per site over a window, for the agency overview. */
export class LeadSiteMetrics implements SiteMetricSource {
  readonly metrics: readonly OverviewMetric[] = ["leads"];

  async totalsBySite(websiteIds: readonly string[], w: MetricWindow): Promise<Map<string, MetricTotals>> {
    if (websiteIds.length === 0) return new Map();
    const rows = await sql<{ website_id: string; n: number | string }[]>`
      SELECT website_id::text AS website_id, COUNT(*)::int AS n
      FROM form_submissions
      WHERE website_id = ANY(${[...websiteIds]}::uuid[])
        AND created_at >= ${w.from}::date AND created_at < ${w.to}::date + 1
      GROUP BY website_id
    `;
    return new Map(rows.map((r) => [r.website_id, { leads: Number(r.n) }]));
  }
}
