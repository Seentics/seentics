/**
 * Machine-facing data API (analytics, replays, heatmaps). Auth: `X-API-Key` per website (`api_keys` table).
 * Base path: `GET /api/v1/raw/...` (mounted from `index.ts`).
 *
 * Analytics read models mirror the session dashboard (`routes/analytics.ts`) — same `analytics.service` functions.
 * Shared query params where applicable: `days`, `timezone`, `limit` (see `services/analytics.service.ts`).
 *
 * Auth: `r.use("*", rawApiAuthMiddleware)` — `X-API-Key` or `x-api-key` must match `api_keys` for `:website_id`.
 * Rate limits: global middleware applies per-IP tier `raw` (`RATE_LIMIT_RAW_MAX`); after a valid key, per-key bucket
 * (`RATE_LIMIT_RAW_PER_KEY_MAX`) — see `middleware/rate-limit.ts` and `middleware/raw-api-auth.ts`.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import { rawApiAuthMiddleware } from "../middleware/raw-api-auth";
import * as analytics from "../services/analytics.service";
import * as raw from "../services/raw-data.service";
import { parseQuery } from "../validators/validation";
import {
  rawEventsQuerySchema,
  rawHeatmapPointsQuerySchema,
  rawRecentActivityQuerySchema,
  rawSessionsQuerySchema,
} from "../validators/raw-data";

const r = new Hono();

/** Every path on this router requires a valid website API key (defense in depth vs per-route middleware). */
r.use("*", rawApiAuthMiddleware);

/** Path param `:website_id` is always set for these routes. */
function websiteId(c: Context): string {
  return c.req.param("website_id") as string;
}

function rawAnalyticsQs(c: { req: { query: (n: string) => string | undefined } }) {
  return {
    days: c.req.query("days"),
    timezone: c.req.query("timezone"),
    limit: c.req.query("limit"),
  };
}

function jsonWithMeta(
  c: { get: (k: "rawApi") => { websiteUuid: string; siteId: string }; json: (b: object) => Response },
  data: unknown,
) {
  const ctx = c.get("rawApi");
  return c.json({
    meta: { website_id: ctx.websiteUuid, site_id: ctx.siteId },
    data,
  });
}

type QsHandler = (websiteId: string, q: Record<string, string | undefined>) => Promise<unknown>;
type SiteHandler = (websiteId: string) => Promise<unknown>;

const RAW_ANALYTICS_WITH_QS: [string, QsHandler][] = [
  ["/v1/websites/:website_id/analytics/traffic-summary", analytics.getTrafficSummaryStats],
  ["/v1/websites/:website_id/analytics/activity-trends", analytics.getActivityTrendsStats],
  ["/v1/websites/:website_id/analytics/top-pages", analytics.getPagesAnalytics],
  ["/v1/websites/:website_id/analytics/top-referrers", analytics.getReferrersAnalytics],
  ["/v1/websites/:website_id/analytics/top-sources", analytics.getSourcesAnalytics],
  ["/v1/websites/:website_id/analytics/top-countries", analytics.getCountriesAnalytics],
  ["/v1/websites/:website_id/analytics/top-browsers", analytics.getBrowsersAnalytics],
  ["/v1/websites/:website_id/analytics/top-devices", analytics.getDevicesAnalytics],
  ["/v1/websites/:website_id/analytics/top-os", analytics.getOsAnalytics],
  ["/v1/websites/:website_id/analytics/top-resolutions", analytics.getResolutionsAnalytics],
  ["/v1/websites/:website_id/analytics/top-languages", analytics.getLanguagesAnalytics],
  ["/v1/websites/:website_id/analytics/top-cities", analytics.getCitiesAnalytics],
  ["/v1/websites/:website_id/analytics/hourly-stats", analytics.getHourlyStatsAnalytics],
  ["/v1/websites/:website_id/analytics/daily-stats", analytics.getDailyStatsAnalytics],
  ["/v1/websites/:website_id/analytics/goals-stats", analytics.getGoalsStats],
  ["/v1/websites/:website_id/analytics/custom-events", analytics.getCustomEventsAnalytics],
  ["/v1/websites/:website_id/analytics/visitor-insights", analytics.getVisitorInsightsAnalytics],
  ["/v1/websites/:website_id/analytics/geolocation-breakdown", analytics.getGeolocationAnalytics],
];

const RAW_ANALYTICS_SITE_ONLY: [string, SiteHandler][] = [
  ["/v1/websites/:website_id/analytics/realtime", analytics.getRealtimeStats],
  ["/v1/websites/:website_id/analytics/live-visitors", analytics.getLiveVisitorsStats],
  ["/v1/websites/:website_id/analytics/path-analysis", analytics.getPathAnalysisAnalytics],
  ["/v1/websites/:website_id/analytics/page-utm-breakdown", analytics.getPageUtmBreakdownAnalytics],
  ["/v1/websites/:website_id/analytics/export", analytics.getExportAnalytics],
];

for (const [path, fn] of RAW_ANALYTICS_WITH_QS) {
  r.get(path, async (c) => {
    const data = await fn(websiteId(c), rawAnalyticsQs(c));
    return jsonWithMeta(c, data);
  });
}

for (const [path, fn] of RAW_ANALYTICS_SITE_ONLY) {
  r.get(path, async (c) => {
    const data = await fn(websiteId(c));
    return jsonWithMeta(c, data);
  });
}

r.get("/v1/websites/:website_id/analytics/dashboard", async (c) => {
  const data = await analytics.getDashboardStats(websiteId(c), rawAnalyticsQs(c));
  return jsonWithMeta(c, data);
});

r.get("/v1/websites/:website_id/analytics/recent-activity", async (c) => {
  const q = parseQuery(c, rawRecentActivityQuerySchema);
  if (!q.ok) return q.res;
  const data = await analytics.getRecentActivityAnalytics(websiteId(c), q.data.limit);
  return jsonWithMeta(c, data);
});

r.get("/v1/websites/:website_id/analytics/events", async (c) => {
  const ctx = c.get("rawApi");
  try {
    const q = parseQuery(c, rawEventsQuerySchema);
    if (!q.ok) return q.res;
    const out = await raw.rawAnalyticsEvents(websiteId(c), {
      from: q.data.from || undefined,
      to: q.data.to || undefined,
      limit: q.data.limit,
      offset: q.data.offset,
      event_type: q.data.event_type || undefined,
    });
    return c.json({
      meta: {
        website_id: ctx.websiteUuid,
        site_id: ctx.siteId,
        limit: out.limit,
        offset: out.offset,
        returned: out.returned,
      },
      events: out.events,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bad request";
    if (msg.includes("bad ")) return c.json({ error: msg, code: "bad_request" }, 400);
    throw e;
  }
});

r.get("/v1/websites/:website_id/sessions", async (c) => {
  const ctx = c.get("rawApi");
  const q = parseQuery(c, rawSessionsQuerySchema);
  if (!q.ok) return q.res;
  const { limit, offset } = q.data;
  const out = await raw.rawSessions(websiteId(c), limit, offset);
  return c.json({
    meta: { website_id: ctx.websiteUuid, site_id: ctx.siteId, limit: out.limit, offset: out.offset },
    sessions: out.sessions,
  });
});

r.get("/v1/websites/:website_id/heatmap/pages", async (c) => {
  const ctx = c.get("rawApi");
  const out = await raw.rawHeatmapPages(websiteId(c));
  return c.json({
    meta: { website_id: ctx.websiteUuid, site_id: ctx.siteId },
    pages: out.pages,
  });
});

r.get("/v1/websites/:website_id/heatmap/points", async (c) => {
  const ctx = c.get("rawApi");
  const q = parseQuery(c, rawHeatmapPointsQuerySchema);
  if (!q.ok) return q.res;
  const out = await raw.rawHeatmapPoints(websiteId(c), q.data.page_path, q.data.event_type);
  return c.json({
    meta: {
      website_id: ctx.websiteUuid,
      site_id: ctx.siteId,
      page_path: out.page_path,
      event_type: out.event_type,
    },
    points: out.points,
  });
});

export const rawDataRoutes = r;
