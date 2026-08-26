/**
 * Public contracts for the analytics module.
 *
 * Depend on the narrowest interface that covers what you need — taking
 * `AnalyticsRealtime` rather than the whole module is what keeps a consumer
 * testable and its coupling legible.
 */
export type {
  AnalyticsBehaviour,
  AnalyticsDashboard,
  AnalyticsDimensions,
  AnalyticsExport,
  AnalyticsGoals,
  AnalyticsPublicDashboard,
  AnalyticsQueryParams,
  AnalyticsRealtime,
  AnalyticsRevenue,
  AnalyticsWindow,
} from "./analytics.interface";
