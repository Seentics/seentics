import type { AnalyticsQueryParams, AnalyticsReads } from "./interfaces";

type Read = (reads: AnalyticsReads, websiteId: string, query: AnalyticsQueryParams) => Promise<unknown>;

/**
 * The dashboard read endpoints (`GET /api/v1/analytics/<name>/:website_id`) an embed link may
 * call, by the name the dashboard uses. Each entry calls the same analytics service method as
 * that route's controller, so an embed returns exactly what the signed-in dashboard does.
 * Deliberately absent: path-analysis, revenue, page-utm-breakdown, export, import.
 */
export const EMBED_ANALYTICS_READS: Record<string, Read> = Object.assign(Object.create(null), {
  "dashboard": (r, id, q) => r.getDashboard(id, q),
  "traffic-summary": (r, id, q) => r.getTrafficSummary(id, q),
  "daily-stats": (r, id, q) => r.getDailyStats(id, q),
  "hourly-stats": (r, id, q) => r.getHourlyStats(id, q),
  "top-pages": (r, id, q) => r.getPages(id, q),
  "top-referrers": (r, id, q) => r.getReferrers(id, q),
  "top-sources": (r, id, q) => r.getSources(id, q),
  "top-browsers": (r, id, q) => r.getBrowsers(id, q),
  "top-devices": (r, id, q) => r.getDevices(id, q),
  "top-os": (r, id, q) => r.getOperatingSystems(id, q),
  "top-countries": (r, id, q) => r.getCountries(id, q),
  "top-cities": (r, id, q) => r.getCities(id, q),
  "top-languages": (r, id, q) => r.getLanguages(id, q),
  "top-resolutions": (r, id, q) => r.getResolutions(id, q),
  "geolocation-breakdown": (r, id, q) => r.getGeolocation(id, q),
  "dimensions-bulk": (r, id, q) => r.getDimensionsBulk(id, q),
  "activity-trends": (r, id, q) => r.getActivityTrends(id, q),
  "visitor-insights": (r, id, q) => r.getVisitorInsights(id, q),
  "custom-events": (r, id, q) => r.getCustomEvents(id, q),
  "goals-stats": (r, id, q) => r.getGoals(id, q),
  "live-visitors": (r, id) => r.getLiveVisitors(id),
} satisfies Record<string, Read>);
