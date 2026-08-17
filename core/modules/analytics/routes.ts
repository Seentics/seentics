import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { parseQuery } from "../../platform/validation";
// Imported from the schema module rather than the `./validators` barrel: these are
// `z.preprocess` schemas whose inferred output type widens to `{}` when it passes
// through a re-export, which silently costs the handlers their parameter types.
import {
  analyticsRealtimeGeoQuerySchema,
  analyticsRecentActivityQuerySchema,
} from "./validators/analytics.schema";
import type { WebsiteQuery } from "../websites/interfaces";
import type { AnalyticsQueryParams } from "./interfaces";
import type { AnalyticsQueryService } from "./services/analytics-query.service";
import type { PublicDashboardService } from "./services/public-dashboard.service";

/**
 * HTTP surface for analytics.
 *
 * A factory rather than a module-level singleton, so dependencies are injected at
 * composition time instead of reached for through imports. That is what lets the
 * same routes run against a stubbed service in tests.
 */
export function createAnalyticsRoutes(deps: {
  analytics: AnalyticsQueryService;
  publicDashboard: PublicDashboardService;
  websites: WebsiteQuery;
}) {
  const { analytics, publicDashboard, websites } = deps;
  const r = new Hono<{ Variables: AuthVars }>();

  /** The three query parameters the windowed endpoints share. */
  function qs(c: Context): AnalyticsQueryParams {
    return {
      days: c.req.query("days"),
      timezone: c.req.query("timezone"),
      limit: c.req.query("limit"),
    };
  }

  /**
   * Authenticate and confirm the caller may read this website's analytics.
   *
   * Returns a `Response` to short-circuit with, or `null` to proceed — the shape
   * that keeps each handler to two lines instead of a nested try/catch.
   *
   * Answers 403 for a website that does not exist as well as one the caller
   * cannot see, so the API cannot be used to discover which site ids are real.
   */
  async function denyUnlessPermitted(
    c: Context<{ Variables: AuthVars }>,
    websiteRef: string,
  ): Promise<Response | null> {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const role = await websites.getRole(websiteRef, userId);
    if (!role) return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);

    return null;
  }

  // ─── Public (unauthenticated) ────────────────────────────────────────────
  // Registered before the auth middleware, since the whole point is that a
  // share link works without a session.

  r.get("/public/dashboard/:public_id", async (c) => {
    const data = await publicDashboard.getPublicDashboard(c.req.param("public_id"), qs(c));
    if (!data) return c.json({ error: "not found" }, 404);
    return c.json(data);
  });

  // ─── Authenticated ───────────────────────────────────────────────────────

  r.use("*", authMiddleware);

  /**
   * The windowed read endpoints, which differ only in which service method they
   * call. Previously twenty near-identical handlers — a table makes an accidental
   * omission of the access check impossible rather than merely unlikely.
   */
  const WINDOWED: [path: string, method: keyof AnalyticsQueryService][] = [
    ["dashboard", "getDashboard"],
    ["traffic-summary", "getTrafficSummary"],
    ["daily-stats", "getDailyStats"],
    ["hourly-stats", "getHourlyStats"],
    ["top-pages", "getPages"],
    ["top-referrers", "getReferrers"],
    ["top-sources", "getSources"],
    ["top-browsers", "getBrowsers"],
    ["top-devices", "getDevices"],
    ["top-os", "getOperatingSystems"],
    ["top-countries", "getCountries"],
    ["top-cities", "getCities"],
    ["top-languages", "getLanguages"],
    ["top-resolutions", "getResolutions"],
    ["geolocation-breakdown", "getGeolocation"],
    ["page-utm-breakdown", "getPageUtmBreakdown"],
    ["dimensions-bulk", "getDimensionsBulk"],
    ["activity-trends", "getActivityTrends"],
    ["path-analysis", "getPathAnalysis"],
    ["visitor-insights", "getVisitorInsights"],
    ["custom-events", "getCustomEvents"],
    ["goals-stats", "getGoals"],
    ["revenue", "getRevenueDashboard"],
    ["export", "exportEvents"],
  ];

  for (const [path, method] of WINDOWED) {
    r.get(`/${path}/:website_id`, async (c) => {
      const websiteRef = c.req.param("website_id");
      const denied = await denyUnlessPermitted(c, websiteRef);
      if (denied) return denied;

      const handler = analytics[method] as (
        ref: string,
        query: AnalyticsQueryParams,
      ) => Promise<unknown>;
      return c.json((await handler.call(analytics, websiteRef, qs(c))) as object);
    });
  }

  // ─── Realtime ────────────────────────────────────────────────────────────
  // Outside the table: these take minute-based windows and validated options
  // rather than the shared day/timezone/limit bag.

  r.get("/realtime/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;
    return c.json((await analytics.getRealtime(websiteRef)) as object);
  });

  r.get("/live-visitors/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;
    return c.json((await analytics.getLiveVisitors(websiteRef)) as object);
  });

  r.get("/recent-activity/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const q = parseQuery(c, analyticsRecentActivityQuerySchema);
    if (!q.ok) return q.res;

    return c.json(
      (await analytics.getRecentActivity(websiteRef, q.data.limit, {
        withinMinutes: q.data.within_minutes,
      })) as object,
    );
  });

  r.get("/realtime-geo/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const q = parseQuery(c, analyticsRealtimeGeoQuerySchema);
    if (!q.ok) return q.res;

    // Left undefined when unset so the repository applies its own default,
    // rather than sending an explicit `withinMinutes: undefined`.
    const opts =
      q.data.within_minutes != null ? { withinMinutes: q.data.within_minutes } : undefined;
    return c.json((await analytics.getRealtimeGeo(websiteRef, opts)) as object);
  });

  // ─── Import ──────────────────────────────────────────────────────────────

  /**
   * Accepted but not implemented. Kept because the dashboard calls it; the body
   * is drained so the client is not left waiting on an unread stream.
   */
  r.post("/import", async (c) => {
    if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
    await c.req.json().catch(() => null);
    return c.json({ ok: true });
  });

  return r;
}
