import { cachedRead } from "../lib/read-cache";
import type { AnalyticsBehaviour, AnalyticsQueryParams } from "../interfaces";
import { getActivityTrendsStats } from "../repositories/activity-trends.repository";
import { getCustomEventsAnalytics } from "../repositories/custom-events.repository";
import { getPathAnalysisAnalytics } from "../repositories/path-analysis.repository";
import { getVisitorInsightsAnalytics } from "../repositories/visitor-insights.repository";

export type VisitorJourneyAnalyticsQueries = {
  getActivityTrendsStats: typeof getActivityTrendsStats;
  getPathAnalysisAnalytics: typeof getPathAnalysisAnalytics;
  getVisitorInsightsAnalytics: typeof getVisitorInsightsAnalytics;
  getCustomEventsAnalytics: typeof getCustomEventsAnalytics;
};

const defaultQueries: VisitorJourneyAnalyticsQueries = {
  getActivityTrendsStats,
  getPathAnalysisAnalytics,
  getVisitorInsightsAnalytics,
  getCustomEventsAnalytics,
};

export class VisitorJourneyAnalyticsService
  implements AnalyticsBehaviour
{
  private readonly queries: VisitorJourneyAnalyticsQueries;

  constructor(queries: Partial<VisitorJourneyAnalyticsQueries> = {}) {
    this.queries = { ...defaultQueries, ...queries };
  }

  /** See the note on the same seam in `DimensionAnalyticsService` for why `op` is passed. */
  private async read(
    op: string,
    websiteId: string,
    query: AnalyticsQueryParams,
    operation: (id: string, q: AnalyticsQueryParams) => Promise<unknown>,
  ): Promise<unknown> {
    return cachedRead(op, websiteId, query, "shared", () =>
      operation(websiteId, query),
    );
  }

  getActivityTrends(id: string, q: AnalyticsQueryParams) { return this.read("activity_trends", id, q, this.queries.getActivityTrendsStats); }
  getPathAnalysis(id: string, q: AnalyticsQueryParams) { return this.read("path_analysis", id, q, this.queries.getPathAnalysisAnalytics); }
  getVisitorInsights(id: string, q: AnalyticsQueryParams) { return this.read("visitor_insights", id, q, this.queries.getVisitorInsightsAnalytics); }
  getCustomEvents(id: string, q: AnalyticsQueryParams) { return this.read("custom_events", id, q, this.queries.getCustomEventsAnalytics); }
}
