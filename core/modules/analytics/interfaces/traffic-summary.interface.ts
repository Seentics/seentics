/**
 * Traffic figures the website list and detail responses embed.
 *
 * Declared by analytics because analytics owns them: `analytics_events` is this
 * module's table, and how a "visitor" or a "bounce" is counted is this module's
 * definition. The websites module imports this type and calls
 * `AnalyticsModule.getTrafficSummary`; it never learns where the numbers come from,
 * which is what stops the websites repository from querying `analytics_events`
 * directly — the way a modular monolith quietly turns back into a monolith.
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
