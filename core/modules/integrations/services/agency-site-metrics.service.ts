import { sql } from "../../../db";
import type { MetricTotals, MetricWindow, OverviewMetric, SiteMetricSource } from "../../agency/interfaces";

/**
 * Conversions sent to ad platforms per site over a window, for the agency overview. One
 * conversion queued for two destinations is one conversion, hence `DISTINCT event_id`.
 * Delivery rows are kept 30 days, so a 90-day window counts only the last 30.
 */
export class ConversionSiteMetrics implements SiteMetricSource {
  readonly metrics: readonly OverviewMetric[] = ["conversions"];

  async totalsBySite(websiteIds: readonly string[], w: MetricWindow): Promise<Map<string, MetricTotals>> {
    if (websiteIds.length === 0) return new Map();
    const rows = await sql<{ website_id: string; n: number | string }[]>`
      SELECT website_id::text AS website_id, COUNT(DISTINCT event_id)::int AS n
      FROM conversion_events
      WHERE website_id = ANY(${[...websiteIds]}::uuid[]) AND status <> 'skipped'
        AND occurred_at >= ${w.from}::date AND occurred_at < ${w.to}::date + 1
      GROUP BY website_id
    `;
    return new Map(rows.map((r) => [r.website_id, { conversions: Number(r.n) }]));
  }
}
