import { cachedRead } from "../lib/read-cache";
import type { AnalyticsRealtime } from "../interfaces";
import { getLiveVisitorsStats } from "../repositories/live-visitors.repository";

export type RealtimeAnalyticsQueries = {
  getLiveVisitorsStats: typeof getLiveVisitorsStats;
};

const defaultQueries: RealtimeAnalyticsQueries = {
  getLiveVisitorsStats,
};

export class RealtimeAnalyticsService
  implements AnalyticsRealtime
{
  private readonly queries: RealtimeAnalyticsQueries;

  constructor(queries: Partial<RealtimeAnalyticsQueries> = {}) {
    this.queries = { ...defaultQueries, ...queries };
  }

  /*
   * `"none"`: deduplicated and timed, never stored.
   *
   * `analyticsCacheMiddleware` already holds these responses, and a live-visitor count
   * kept a second time underneath it would not be slightly stale, it would be wrong —
   * the badge's whole claim is that it reflects this moment. Sharing one in-flight query
   * between concurrent callers costs nothing in freshness, so that part is kept.
   */

  async getLiveVisitors(websiteId: string): Promise<unknown> {
    return cachedRead("live_visitors", websiteId, null, "none", () =>
      this.queries.getLiveVisitorsStats(websiteId));
  }
}
