import { Hono } from "hono";
import type { AnalyticsQueryParams } from "../lib/api-types";
import { authMiddleware, requireUser, type AuthVars } from "../middleware/auth";
import * as an from "../services/analytics.service";

const r = new Hono<{ Variables: AuthVars }>();

function qs(c: { req: { query: (name: string) => string | undefined } }): AnalyticsQueryParams {
  return {
    days: c.req.query("days"),
    timezone: c.req.query("timezone"),
    limit: c.req.query("limit"),
  };
}

r.get("/public/dashboard/:public_id", async (c) => {
  const out = await an.publicDashboard(c.req.param("public_id"), qs(c));
  if (!out) return c.json({ error: "not found" }, 404);
  return c.json(out);
});

r.use("*", authMiddleware);

r.get("/dashboard/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.getDashboard(c.req.param("website_id"), qs(c)));
});

r.get("/top-pages/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topPages(c.req.param("website_id"), qs(c)));
});

r.get("/top-referrers/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topReferrers(c.req.param("website_id"), qs(c)));
});

r.get("/top-sources/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topSources(c.req.param("website_id"), qs(c)));
});

r.get("/top-countries/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topCountries(c.req.param("website_id"), qs(c)));
});

r.get("/top-browsers/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topBrowsers(c.req.param("website_id"), qs(c)));
});

r.get("/top-devices/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topDevices(c.req.param("website_id"), qs(c)));
});

r.get("/top-os/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topOS(c.req.param("website_id"), qs(c)));
});

r.get("/top-resolutions/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topResolutions(c.req.param("website_id"), qs(c)));
});

r.get("/top-languages/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topLanguages(c.req.param("website_id"), qs(c)));
});

r.get("/top-cities/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.topCities(c.req.param("website_id"), qs(c)));
});

r.get("/traffic-summary/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.trafficSummary(c.req.param("website_id"), qs(c)));
});

r.get("/activity-trends/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.activityTrends(c.req.param("website_id"), qs(c)));
});

r.get("/page-utm-breakdown/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.pageUtmBreakdown(c.req.param("website_id")));
});

r.get("/hourly-stats/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.hourlyStats(c.req.param("website_id"), qs(c)));
});

r.get("/daily-stats/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.dailyStats(c.req.param("website_id"), qs(c)));
});

r.get("/goals-stats/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.goalsStats(c.req.param("website_id"), qs(c)));
});

r.get("/custom-events/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.customEvents(c.req.param("website_id"), qs(c)));
});

r.get("/realtime/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.realtime(c.req.param("website_id")));
});

r.get("/live-visitors/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.liveVisitors(c.req.param("website_id")));
});

r.get("/visitor-insights/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.visitorInsights(c.req.param("website_id"), qs(c)));
});

r.get("/recent-activity/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  const lim = Number(c.req.query("limit") ?? "50");
  return c.json(await an.recentActivity(c.req.param("website_id"), lim));
});

r.get("/geolocation-breakdown/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.geolocation(c.req.param("website_id"), qs(c)));
});

r.get("/path-analysis/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.pathAnalysis(c.req.param("website_id")));
});

r.get("/export/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(await an.exportAnalytics(c.req.param("website_id")));
});

r.post("/import", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  void c.req.json().catch(() => null);
  return c.json(await an.importAnalytics());
});

export const analyticsRoutes = r;
