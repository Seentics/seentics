import type { WebsiteQuery } from "../../websites/interfaces";
import type {
  AnalyticsBehaviour,
  AnalyticsDashboard,
  AnalyticsDimensions,
  AnalyticsExport,
  AnalyticsGoals,
  AnalyticsQueryParams,
  AnalyticsRealtime,
  AnalyticsRevenue,
} from "../interfaces";
import { getActivityTrendsStats } from "../repositories/activity-trends.repository";
import { getCitiesAnalytics } from "../repositories/cities.repository";
import { getCustomEventsAnalytics } from "../repositories/custom-events.repository";
import { getDailyStatsAnalytics } from "../repositories/daily-stats.repository";
import { getDashboardStats } from "../repositories/dashboard.repository";
import { getDimensionsBulkAnalytics } from "../repositories/dimensions-bulk.repository";
import {
  getBrowsersAnalytics,
  getCountriesAnalytics,
  getDevicesAnalytics,
  getOsAnalytics,
} from "../repositories/dimensions.repository";
import { getExportAnalytics } from "../repositories/export.repository";
import { getGeolocationAnalytics } from "../repositories/geolocation.repository";
import { getGoalsStats } from "../repositories/goals.repository";
import { getHourlyStatsAnalytics } from "../repositories/hourly-stats.repository";
import { getLanguagesAnalytics } from "../repositories/languages.repository";
import { getLiveVisitorsStats } from "../repositories/live-visitors.repository";
import { getPageUtmBreakdownAnalytics } from "../repositories/page-utm-breakdown.repository";
import { getPagesAnalytics } from "../repositories/pages.repository";
import { getPathAnalysisAnalytics } from "../repositories/path-analysis.repository";
import { getRealtimeGeoAnalytics } from "../repositories/realtime-geo.repository";
import { getRealtimeStats } from "../repositories/realtime.repository";
import { getRecentActivityAnalytics } from "../repositories/recent-activity.repository";
import { getReferrersAnalytics } from "../repositories/referrers.repository";
import { getResolutionsAnalytics } from "../repositories/resolutions.repository";
import { getRevenueDashboard } from "../repositories/revenue.repository";
import { getSourcesAnalytics } from "../repositories/sources.repository";
import { getTrafficSummaryStats } from "../repositories/traffic-summary.repository";
import { getVisitorInsightsAnalytics } from "../repositories/visitor-insights.repository";

/**
 * Raised when an analytics query names a website that does not exist.
 *
 * Carries `status` so the HTTP layer maps it to 404 rather than a 500. Access
 * control is *not* this class's job — routes authorize before calling, using the
 * websites module — but resolution failure has to be distinguishable from an
 * empty result set, or a typo'd site id would render as "no traffic".
 */
export class UnknownWebsiteError extends Error {
  readonly status = 404;
  constructor(websiteId: string) {
    super(`unknown website: ${websiteId}`);
    this.name = "UnknownWebsiteError";
  }
}

/**
 * The analytics read path.
 *
 * Its one structural job is to resolve a website reference exactly once per
 * request and hand the resolved `websiteId` to the repositories. Every query used to
 * do that resolution itself, which meant analytics read the `websites` table
 * directly — a cross-module table read — and paid for the lookup again on every
 * call. Resolution now goes through the injected `WebsiteQuery` port.
 *
 * That change is type-invisible: `websiteId` and `websiteId` are both `string`, so
 * the compiler cannot catch a route that passes an unresolved reference straight
 * to a repository. This service existing as the *only* caller of the repositories
 * is what enforces it — routes must not import from `../repositories`.
 */
export class AnalyticsQueryService
  implements
    AnalyticsDashboard,
    AnalyticsDimensions,
    AnalyticsRealtime,
    AnalyticsBehaviour,
    AnalyticsGoals,
    AnalyticsRevenue,
    AnalyticsExport
{
  constructor(private readonly websites: WebsiteQuery) {}

  /**
   * Reject a query for a website that does not exist.
   *
   * This used to be a `resolve` that turned a loose reference into the two identifiers
   * the repositories needed — analytics rows were keyed by a short public id while
   * `goals` used the UUID. With a single identifier there is nothing to translate, so
   * what remains is the check that was always the other half of its job: a query
   * against an unknown website must fail rather than return a confident empty result.
   */
  private async assertExists(websiteId: string): Promise<void> {
    if (!(await this.websites.getById(websiteId))) throw new UnknownWebsiteError(websiteId);
  }

  // ─── AnalyticsDashboard ──────────────────────────────────────────────────

  async getDashboard(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getDashboardStats(websiteId, query);
  }

  async getTrafficSummary(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getTrafficSummaryStats(websiteId, query);
  }

  async getDailyStats(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getDailyStatsAnalytics(websiteId, query);
  }

  async getHourlyStats(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getHourlyStatsAnalytics(websiteId, query);
  }

  // ─── AnalyticsDimensions ─────────────────────────────────────────────────

  async getPages(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getPagesAnalytics(websiteId, query);
  }

  async getReferrers(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getReferrersAnalytics(websiteId, query);
  }

  async getSources(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getSourcesAnalytics(websiteId, query);
  }

  async getBrowsers(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getBrowsersAnalytics(websiteId, query);
  }

  async getDevices(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getDevicesAnalytics(websiteId, query);
  }

  async getOperatingSystems(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getOsAnalytics(websiteId, query);
  }

  async getCountries(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getCountriesAnalytics(websiteId, query);
  }

  async getCities(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getCitiesAnalytics(websiteId, query);
  }

  async getLanguages(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getLanguagesAnalytics(websiteId, query);
  }

  async getResolutions(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getResolutionsAnalytics(websiteId, query);
  }

  async getGeolocation(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getGeolocationAnalytics(websiteId, query);
  }

  async getPageUtmBreakdown(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getPageUtmBreakdownAnalytics(websiteId, query);
  }

  async getDimensionsBulk(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getDimensionsBulkAnalytics(websiteId, query);
  }

  // ─── AnalyticsRealtime ───────────────────────────────────────────────────

  async getRealtime(websiteId: string): Promise<unknown> {
    await this.assertExists(websiteId);
    return getRealtimeStats(websiteId);
  }

  async getRealtimeGeo(
    websiteId: string,
    opts?: { withinMinutes?: number },
  ): Promise<unknown> {
    await this.assertExists(websiteId);
    return getRealtimeGeoAnalytics(websiteId, opts);
  }

  async getLiveVisitors(websiteId: string): Promise<unknown> {
    await this.assertExists(websiteId);
    return getLiveVisitorsStats(websiteId);
  }

  async getRecentActivity(
    websiteId: string,
    limit: number,
    opts?: { withinMinutes?: number },
  ): Promise<unknown> {
    await this.assertExists(websiteId);
    return getRecentActivityAnalytics(websiteId, limit, opts);
  }

  async getActivityTrends(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getActivityTrendsStats(websiteId, query);
  }

  // ─── AnalyticsBehaviour ──────────────────────────────────────────────────

  async getPathAnalysis(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getPathAnalysisAnalytics(websiteId, query);
  }

  async getVisitorInsights(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getVisitorInsightsAnalytics(websiteId, query);
  }

  async getCustomEvents(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getCustomEventsAnalytics(websiteId, query);
  }

  // ─── AnalyticsGoals ──────────────────────────────────────────────────────

  /**
   * Goal conversions.
   *
   * This one used to need both identifiers: goal definitions live in `goals`, keyed by
   * the website UUID, and the events they are matched against live in
   * `analytics_events`, which was keyed by a different, shorter id. The join now works
   * off one column.
   */
  async getGoals(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getGoalsStats(websiteId, query);
  }

  // ─── AnalyticsRevenue ────────────────────────────────────────────────────

  async getRevenueDashboard(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getRevenueDashboard(websiteId, query);
  }

  // ─── AnalyticsExport ─────────────────────────────────────────────────────

  async exportEvents(websiteId: string, query: AnalyticsQueryParams): Promise<unknown> {
    await this.assertExists(websiteId);
    return getExportAnalytics(websiteId, query);
  }
}
