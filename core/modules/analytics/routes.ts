import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { parseQuery } from "../../platform/validation";
// From the schema module, not the `./validators` barrel: these are `z.preprocess`
// schemas whose inferred output widens to `{}` when re-exported, which silently
// costs the two handlers that use them their parameter types.
import {
  analyticsRealtimeGeoQuerySchema,
  analyticsRecentActivityQuerySchema,
} from "./validators/analytics.schema";
import type { WebsiteQuery } from "../websites/interfaces";
import type { AnalyticsQueryParams } from "./interfaces";
import type { AnalyticsQueryService } from "./services/analytics-query.service";
import type { PublicDashboardService } from "./services/public-dashboard.service";

type AnalyticsContext = Context<{ Variables: AuthVars }>;

/**
 * HTTP surface for analytics.
 *
 * A factory rather than a module-level singleton, so dependencies arrive at
 * composition time instead of being reached for through imports — which is what
 * lets these routes run against a stubbed service in a test.
 */
export function createAnalyticsRoutes(deps: {
  analytics: AnalyticsQueryService;
  publicDashboard: PublicDashboardService;
  websites: WebsiteQuery;
}) {
  const { analytics, publicDashboard, websites } = deps;
  const r = new Hono<{ Variables: AuthVars }>();

  /** The three query parameters the windowed endpoints share. */
  function qs(c: AnalyticsContext): AnalyticsQueryParams {
    return {
      days: c.req.query("days"),
      timezone: c.req.query("timezone"),
      limit: c.req.query("limit"),
    };
  }

  /**
   * Confirm the caller may read this website's analytics.
   *
   * Returns a `Response` to answer with, or `null` to proceed.
   *
   * Answers 403 for a website that does not exist as well as one the caller cannot
   * see, so the API cannot be used to discover which site ids are real.
   */
  async function denyUnlessPermitted(
    c: AnalyticsContext,
    websiteRef: string,
  ): Promise<Response | null> {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const role = await websites.getRole(websiteRef, userId);
    if (!role) return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);

    return null;
  }

  /**
   * Build a handler for a read that needs nothing but the website reference and the
   * shared query bag — which is all but two of the routes below.
   *
   * The access check lives here so it cannot be omitted from an individual route,
   * and the `as object` cast lives here instead of at every call site: the service's
   * read models are typed `unknown` because they are SQL projections consumed
   * directly by the dashboard, not shapes any peer module reads.
   */
  function guarded(read: (c: AnalyticsContext, websiteRef: string) => Promise<unknown>) {
    return async (c: AnalyticsContext) => {
      // `param` is typed optional because this handler is generic over the path.
      // Hono only routes here when `:website_id` matched, so in practice it is
      // always present; the check both satisfies the type and answers sensibly if a
      // route were ever registered without that segment.
      const websiteRef = c.req.param("website_id");
      if (!websiteRef) return c.json({ error: "not found" }, 404);

      const denied = await denyUnlessPermitted(c, websiteRef);
      if (denied) return denied;

      return c.json((await read(c, websiteRef)) as object);
    };
  }
  

  // ─── Public (unauthenticated) ─────────────────────────────────────────────
  // Registered before the auth middleware, since the whole point of a share link
  // is that it works without a session.

  r.get("/public/dashboard/:public_id", async (c) => {
    const data = await publicDashboard.getPublicDashboard(c.req.param("public_id"), qs(c));
    if (!data) return c.json({ error: "not found" }, 404);
    return c.json(data);
  });

  // ─── Authenticated ────────────────────────────────────────────────────────

  r.use("*", authMiddleware);

  // Headline figures and time series.
  r.get("/dashboard/:website_id", guarded((c, w) => analytics.getDashboard(w, qs(c))));
  r.get("/traffic-summary/:website_id", guarded((c, w) => analytics.getTrafficSummary(w, qs(c))));
  r.get("/daily-stats/:website_id", guarded((c, w) => analytics.getDailyStats(w, qs(c))));
  r.get("/hourly-stats/:website_id", guarded((c, w) => analytics.getHourlyStats(w, qs(c))));

  // Breakdowns by a single attribute. `dimensions-bulk` answers several in one
  // round trip — prefer it when a view needs more than two.
  r.get("/top-pages/:website_id", guarded((c, w) => analytics.getPages(w, qs(c))));
  r.get("/top-referrers/:website_id", guarded((c, w) => analytics.getReferrers(w, qs(c))));
  r.get("/top-sources/:website_id", guarded((c, w) => analytics.getSources(w, qs(c))));
  r.get("/top-browsers/:website_id", guarded((c, w) => analytics.getBrowsers(w, qs(c))));
  r.get("/top-devices/:website_id", guarded((c, w) => analytics.getDevices(w, qs(c))));
  r.get("/top-os/:website_id", guarded((c, w) => analytics.getOperatingSystems(w, qs(c))));
  r.get("/top-countries/:website_id", guarded((c, w) => analytics.getCountries(w, qs(c))));
  r.get("/top-cities/:website_id", guarded((c, w) => analytics.getCities(w, qs(c))));
  r.get("/top-languages/:website_id", guarded((c, w) => analytics.getLanguages(w, qs(c))));
  r.get("/top-resolutions/:website_id", guarded((c, w) => analytics.getResolutions(w, qs(c))));
  r.get(
    "/geolocation-breakdown/:website_id",
    guarded((c, w) => analytics.getGeolocation(w, qs(c))),
  );
  r.get(
    "/page-utm-breakdown/:website_id",
    guarded((c, w) => analytics.getPageUtmBreakdown(w, qs(c))),
  );
  r.get("/dimensions-bulk/:website_id", guarded((c, w) => analytics.getDimensionsBulk(w, qs(c))));

  // Journey and per-visitor analysis.
  r.get("/activity-trends/:website_id", guarded((c, w) => analytics.getActivityTrends(w, qs(c))));
  r.get("/path-analysis/:website_id", guarded((c, w) => analytics.getPathAnalysis(w, qs(c))));
  r.get("/visitor-insights/:website_id", guarded((c, w) => analytics.getVisitorInsights(w, qs(c))));
  r.get("/custom-events/:website_id", guarded((c, w) => analytics.getCustomEvents(w, qs(c))));

  // Conversions, revenue, extraction.
  r.get("/goals-stats/:website_id", guarded((c, w) => analytics.getGoals(w, qs(c))));
  r.get("/revenue/:website_id", guarded((c, w) => analytics.getRevenueDashboard(w, qs(c))));
  r.get("/export/:website_id", guarded((c, w) => analytics.exportEvents(w, qs(c))));

  // ─── Realtime ─────────────────────────────────────────────────────────────
  // Minute-based windows rather than the shared day/timezone/limit bag. The first
  // two take no options at all.

  r.get("/realtime/:website_id", guarded((_c, w) => analytics.getRealtime(w)));
  r.get("/live-visitors/:website_id", guarded((_c, w) => analytics.getLiveVisitors(w)));

  // The last two validate their options with a schema, so they are written out in
  // full rather than squeezed through `guarded` — a validation failure has to answer
  // with the validator's own field-error response, not a 200.

  r.get("/recent-activity/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const q = parseQuery(c, analyticsRecentActivityQuerySchema);
    if (!q.ok) return q.res;

    const data = await analytics.getRecentActivity(websiteRef, q.data.limit, {
      withinMinutes: q.data.within_minutes,
    });
    return c.json(data as object);
  });

  r.get("/realtime-geo/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const q = parseQuery(c, analyticsRealtimeGeoQuerySchema);
    if (!q.ok) return q.res;

    // Left undefined when unset so the repository applies its own default rather
    // than receiving an explicit `withinMinutes: undefined`.
    const opts =
      q.data.within_minutes != null ? { withinMinutes: q.data.within_minutes } : undefined;
    const data = await analytics.getRealtimeGeo(websiteRef, opts);
    return c.json(data as object);
  });

  // ─── Import ───────────────────────────────────────────────────────────────

  /**
   * Accepted but not implemented. Kept because the dashboard calls it; the body is
   * drained so the client is not left waiting on an unread stream.
   */
  r.post("/import", async (c) => {
    if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
    await c.req.json().catch(() => null);
    return c.json({ ok: true });
  });

  return r;
}
