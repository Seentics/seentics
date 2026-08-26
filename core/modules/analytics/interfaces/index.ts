/**
 * Public contracts for the analytics module.
 *
 * `AnalyticsModule` is the whole surface, and what a peer module receives at
 * composition time. Inside this module, and anywhere a narrower dependency is
 * natural, prefer the individual capability — taking `AnalyticsRealtime` rather than
 * the module keeps a consumer testable with a three-method stub.
 */
export type { AnalyticsModule } from "./analytics.module";

export type { TrafficSummary } from "./traffic-summary.interface";
export { emptyTrafficSummary } from "./traffic-summary.interface";

export type {
  AnalyticsBehaviour,
  AnalyticsDashboard,
  AnalyticsDimensions,
  AnalyticsExport,
  AnalyticsFunnelEvents,
  AnalyticsGoals,
  AnalyticsIngestWriter,
  AnalyticsPageviewUrls,
  AnalyticsPublicDashboard,
  AnalyticsQueryParams,
  AnalyticsRawEvents,
  AnalyticsReads,
  AnalyticsRealtime,
  AnalyticsRevenue,
  AnalyticsWindow,
} from "./analytics.interface";
