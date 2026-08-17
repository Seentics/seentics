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
  constructor(websiteRef: string) {
    super(`unknown website: ${websiteRef}`);
    this.name = "UnknownWebsiteError";
  }
}

/**
 * The analytics read path.
 *
 * Its one structural job is to resolve a website reference exactly once per
 * request and hand the resolved `siteId` to the repositories. Every query used to
 * do that resolution itself, which meant analytics read the `websites` table
 * directly — a cross-module table read — and paid for the lookup again on every
 * call. Resolution now goes through the injected `WebsiteQuery` port.
 *
 * That change is type-invisible: `websiteRef` and `siteId` are both `string`, so
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
   * Turn a loose website reference (UUID or `siteId`) into the identifiers the
   * repositories need.
   *
   * Analytics rows are keyed by the short `siteId`; the `goals` table is keyed by
   * the website UUID. Returning both means a query that spans them does not have
   * to resolve twice.
   */
  private async resolve(websiteRef: string): Promise<{ siteId: string; websiteUuid: string }> {
    const website = await this.websites.getById(websiteRef);
    if (!website) throw new UnknownWebsiteError(websiteRef);
    return { siteId: website.siteId, websiteUuid: website.id };
  }

  // ─── AnalyticsDashboard ──────────────────────────────────────────────────

  async getDashboard(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getDashboardStats(siteId, query);
  }

  async getTrafficSummary(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getTrafficSummaryStats(siteId, query);
  }

  async getDailyStats(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getDailyStatsAnalytics(siteId, query);
  }

  async getHourlyStats(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getHourlyStatsAnalytics(siteId, query);
  }

  // ─── AnalyticsDimensions ─────────────────────────────────────────────────

  async getPages(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getPagesAnalytics(siteId, query);
  }

  async getReferrers(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getReferrersAnalytics(siteId, query);
  }

  async getSources(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getSourcesAnalytics(siteId, query);
  }

  async getBrowsers(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getBrowsersAnalytics(siteId, query);
  }

  async getDevices(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getDevicesAnalytics(siteId, query);
  }

  async getOperatingSystems(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getOsAnalytics(siteId, query);
  }

  async getCountries(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getCountriesAnalytics(siteId, query);
  }

  async getCities(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getCitiesAnalytics(siteId, query);
  }

  async getLanguages(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getLanguagesAnalytics(siteId, query);
  }

  async getResolutions(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getResolutionsAnalytics(siteId, query);
  }

  async getGeolocation(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getGeolocationAnalytics(siteId, query);
  }

  async getPageUtmBreakdown(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getPageUtmBreakdownAnalytics(siteId, query);
  }

  async getDimensionsBulk(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getDimensionsBulkAnalytics(siteId, query);
  }

  // ─── AnalyticsRealtime ───────────────────────────────────────────────────

  async getRealtime(websiteRef: string): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getRealtimeStats(siteId);
  }

  async getRealtimeGeo(
    websiteRef: string,
    opts?: { withinMinutes?: number },
  ): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getRealtimeGeoAnalytics(siteId, opts);
  }

  async getLiveVisitors(websiteRef: string): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getLiveVisitorsStats(siteId);
  }

  async getRecentActivity(
    websiteRef: string,
    limit: number,
    opts?: { withinMinutes?: number },
  ): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getRecentActivityAnalytics(siteId, limit, opts);
  }

  async getActivityTrends(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getActivityTrendsStats(siteId, query);
  }

  // ─── AnalyticsBehaviour ──────────────────────────────────────────────────

  async getPathAnalysis(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getPathAnalysisAnalytics(siteId, query);
  }

  async getVisitorInsights(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getVisitorInsightsAnalytics(siteId, query);
  }

  async getCustomEvents(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getCustomEventsAnalytics(siteId, query);
  }

  // ─── AnalyticsGoals ──────────────────────────────────────────────────────

  /**
   * Goal conversions. Needs both identifiers: goal definitions live in `goals`
   * keyed by the website UUID, while the conversions they are matched against
   * live in `analytics_events` keyed by `siteId`.
   */
  async getGoals(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId, websiteUuid } = await this.resolve(websiteRef);
    return getGoalsStats(siteId, websiteUuid, query);
  }

  // ─── AnalyticsRevenue ────────────────────────────────────────────────────

  async getRevenueDashboard(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getRevenueDashboard(siteId, query);
  }

  // ─── AnalyticsExport ─────────────────────────────────────────────────────

  async exportEvents(websiteRef: string, query: AnalyticsQueryParams): Promise<unknown> {
    const { siteId } = await this.resolve(websiteRef);
    return getExportAnalytics(siteId, query);
  }
}
