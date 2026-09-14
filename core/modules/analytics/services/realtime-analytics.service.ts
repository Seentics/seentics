import { cachedRead } from "../lib/read-cache";
import type { AnalyticsRealtime } from "../interfaces";
import { getLiveVisitorsStats } from "../repositories/live-visitors.repository";
import { getRealtimeGeoAnalytics } from "../repositories/realtime-geo.repository";
import { getRealtimeStats } from "../repositories/realtime.repository";
import { getRecentActivityAnalytics } from "../repositories/recent-activity.repository";

export type RealtimeAnalyticsQueries = {
  getRealtimeStats: typeof getRealtimeStats;
  getRealtimeGeoAnalytics: typeof getRealtimeGeoAnalytics;
  getLiveVisitorsStats: typeof getLiveVisitorsStats;
  getRecentActivityAnalytics: typeof getRecentActivityAnalytics;
};

const defaultQueries: RealtimeAnalyticsQueries = {
  getRealtimeStats,
  getRealtimeGeoAnalytics,
  getLiveVisitorsStats,
  getRecentActivityAnalytics,
};

export class RealtimeAnalyticsService
  implements AnalyticsRealtime
{
  private readonly queries: RealtimeAnalyticsQueries;

  constructor(queries: Partial<RealtimeAnalyticsQueries> = {}) {
    this.queries = { ...defaultQueries, ...queries };
  }

  /*
   * Every read here is `"none"`: deduplicated and timed, never stored.
   *
   * `analyticsCacheMiddleware` already holds these responses, and a live-visitor count
   * kept a second time underneath it would not be slightly stale, it would be wrong —
   * the panel's whole claim is that it reflects this moment. Sharing one in-flight query
   * between concurrent callers costs nothing in freshness, so that part is kept.
   */

  async getRealtime(websiteId: string): Promise<unknown> {
    return cachedRead("realtime", websiteId, null, "none", () =>
      this.queries.getRealtimeStats(websiteId));
  }

  async getRealtimeGeo(websiteId: string, opts?: { withinMinutes?: number }): Promise<unknown> {
    return cachedRead("realtime_geo", websiteId, opts ?? null, "none", () =>
      this.queries.getRealtimeGeoAnalytics(websiteId, opts));
  }

  async getLiveVisitors(websiteId: string): Promise<unknown> {
    return cachedRead("live_visitors", websiteId, null, "none", () =>
      this.queries.getLiveVisitorsStats(websiteId));
  }

  async getRecentActivity(
    websiteId: string,
    limit: number,
    opts?: { withinMinutes?: number },
  ): Promise<unknown> {
    return cachedRead("recent_activity", websiteId, { limit, ...opts }, "none", () =>
      this.queries.getRecentActivityAnalytics(websiteId, limit, opts));
  }
}

