import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AnalyticsQueryParams } from "../lib/api-types";
import { authMiddleware, requireUser, type AuthVars } from "../middleware/auth";
import { assertOwnerOrMember } from "../services/access.service";
import * as an from "../services/analytics.service";
import { parseQuery } from "../validators/validation";
import {
  analyticsRealtimeGeoQuerySchema,
  analyticsRecentActivityQuerySchema,
} from "../validators/analytics";

const r = new Hono<{ Variables: AuthVars }>();

function qs(c: { req: { query: (name: string) => string | undefined } }): AnalyticsQueryParams {
  return {
    days: c.req.query("days"),
    timezone: c.req.query("timezone"),
    limit: c.req.query("limit"),
  };
}

/**
 * Auth + website ownership guard for all authenticated analytics endpoints.
 * Returns an error Response to short-circuit with, or null when access is allowed.
 * Accepts site_id or UUID — assertOwnerOrMember resolves to the canonical UUID.
 */
async function requireWebsiteAccess(
  c: Context<{ Variables: AuthVars }>,
  websiteId: string,
): Promise<Response | null> {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
  return null;
}

r.get("/public/dashboard/:public_id", async (c) => {
  const out = await an.getPublicDashboardStats(c.req.param("public_id"), qs(c));
  if (!out) return c.json({ error: "not found" }, 404);
  return c.json(out);
});

r.use("*", authMiddleware);

r.get("/dashboard/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getDashboardStats(c.req.param("website_id"), qs(c)));
});

r.get("/top-pages/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getPagesAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-referrers/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getReferrersAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-sources/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getSourcesAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-countries/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getCountriesAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-browsers/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getBrowsersAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-devices/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getDevicesAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-os/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getOsAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/dimensions-bulk/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getDimensionsBulkAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-resolutions/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getResolutionsAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-languages/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getLanguagesAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/top-cities/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getCitiesAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/traffic-summary/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getTrafficSummaryStats(c.req.param("website_id"), qs(c)));
});

r.get("/activity-trends/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getActivityTrendsStats(c.req.param("website_id"), qs(c)));
});

r.get("/page-utm-breakdown/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getPageUtmBreakdownAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/hourly-stats/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getHourlyStatsAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/daily-stats/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getDailyStatsAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/goals-stats/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getGoalsStats(c.req.param("website_id"), qs(c)));
});

r.get("/custom-events/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getCustomEventsAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/realtime/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getRealtimeStats(c.req.param("website_id")));
});

r.get("/live-visitors/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getLiveVisitorsStats(c.req.param("website_id")));
});

r.get("/visitor-insights/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getVisitorInsightsAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/recent-activity/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  const q = parseQuery(c, analyticsRecentActivityQuerySchema);
  if (!q.ok) return q.res;
  const lim = q.data.limit;
  const withinMinutes = q.data.within_minutes;
  return c.json(
    await an.getRecentActivityAnalytics(c.req.param("website_id"), lim, { withinMinutes }),
  );
});

r.get("/realtime-geo/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  const q = parseQuery(c, analyticsRealtimeGeoQuerySchema);
  if (!q.ok) return q.res;
  const opts =
    q.data.within_minutes != null ? { withinMinutes: q.data.within_minutes } : undefined;
  return c.json(await an.getRealtimeGeoAnalytics(c.req.param("website_id"), opts));
});

r.get("/geolocation-breakdown/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getGeolocationAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/path-analysis/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getPathAnalysisAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/export/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getExportAnalytics(c.req.param("website_id"), qs(c)));
});

r.get("/revenue/:website_id", async (c) => {
  const denied = await requireWebsiteAccess(c, c.req.param("website_id"));
  if (denied) return denied;
  return c.json(await an.getRevenueDashboard(c.req.param("website_id"), qs(c)));
});

r.post("/import", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  void c.req.json().catch(() => null);
  return c.json(await an.importAnalytics());
});

export const analyticsRoutes = r;
