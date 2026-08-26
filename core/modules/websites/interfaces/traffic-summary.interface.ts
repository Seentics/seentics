/**
 * Traffic figures the website list and detail responses embed.
 *
 * This is a **port**: the websites module declares the analytics capability it
 * needs, and the analytics module implements it. Declaring it here rather than
 * importing an analytics type is what keeps the dependency pointing one way —
 * websites never learns that `analytics_events` exists, and analytics stays free
 * to change how the numbers are computed.
 *
 * Without this seam the websites repository would query `analytics_events`
 * directly, which is how a modular monolith quietly turns back into a monolith.
 */

export type TrafficSummary = {
  totalPageviews: number;
  uniqueVisitors: number;
  averageSessionDuration: number;
  bounceRate: number;
};

/** All-zero summary — the correct answer for a site with no traffic yet. */
export function emptyTrafficSummary(): TrafficSummary {
  return {
    totalPageviews: 0,
    uniqueVisitors: 0,
    averageSessionDuration: 0,
    bounceRate: 0,
  };
}

export interface TrafficSummaryProvider {
  /**
   * Trailing-30-day figures for many sites at once, keyed by `siteId`.
   *
   * Batched rather than per-site because the website list renders every site the
   * user owns; a per-site call there is an N+1 on the dashboard's hottest page.
   * Sites with no traffic may be absent from the map — callers should fall back
   * to `emptyTrafficSummary()` rather than treating absence as an error.
   */
  summarizeSites(siteIds: string[]): Promise<Map<string, TrafficSummary>>;
}
