/**
 * Machine-facing data API (analytics, replays, heatmaps). Auth: `X-API-Key` per website (`api_keys` table).
 * Base path: `GET /api/v1/raw/...` (mounted from `index.ts`).
 *
 * Analytics read models mirror the session dashboard (`modules/analytics/routes.ts`) — both go through
 * `AnalyticsQueryService`, so the two surfaces cannot drift apart.
 * Shared query params where applicable: `days`, `timezone`, `limit`.
 *
 * Auth: `r.use("*", rawApiAuthMiddleware)` — `X-API-Key` or `x-api-key` must match `api_keys` for `:website_id`.
 * Rate limits: global middleware applies per-IP tier `raw` (`RATE_LIMIT_RAW_MAX`); after a valid key, per-key bucket
 * (`RATE_LIMIT_RAW_PER_KEY_MAX`) — see `middleware/rate-limit.ts` and `middleware/raw-api-auth.ts`.
 */
import { Hono } from "hono";
import type { Context } from "hono";
import { rawApiAuthMiddleware, requireScope } from "../../platform/middleware/raw-api-auth";
import type { AnalyticsReads } from "../../modules/analytics/interfaces";
import * as raw from "./raw-data.service";
import { parseQuery } from "../../platform/validation";
import { API_BASE_PATH, API_CATALOGUE } from "./api-catalogue";
import {
  rawEventsQuerySchema,
  rawHeatmapPointsQuerySchema,
  rawRecentActivityQuerySchema,
  rawSessionsQuerySchema,
} from "./raw-data.schema";

/**
 * Machine-facing data API.
 *
 * A factory so every module surface arrives by injection rather than through a
 * module-level import — the same reason `modules/analytics/routes.ts` is one. Before
 * this, the read layer behind these handlers held its own `analytics_events` query and
 * imported the heatmaps and recordings services directly.
 */
export function createRawDataRoutes(deps: {
  analytics: AnalyticsReads;
  /** The three module ports the read layer fans out to. */
  ports: raw.RawDataPorts;
}) {
const { analytics, ports } = deps;
const r = new Hono();

/**
 * What this API offers.
 *
 * Registered *before* the auth middleware on purpose: a developer has to be able to read
 * the reference in order to decide they want a key, and requiring a key to discover what
 * the key is for is a loop. It exposes no data — only paths, parameters and scopes.
 */
r.get("/v1/catalogue", (c) =>
  c.json({
    meta: { base_path: API_BASE_PATH, auth: "X-API-Key", count: API_CATALOGUE.length },
    data: API_CATALOGUE,
  }),
);

/** Every other path on this router requires a valid website API key (defense in depth vs per-route middleware). */
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
  c: { get: (k: "rawApi") => { websiteId: string }; json: (b: object) => Response },
  data: unknown,
) {
  const ctx = c.get("rawApi");
  return c.json({
    meta: { website_id: ctx.websiteId },
    data,
  });
}

type QsHandler = (websiteRef: string, q: Record<string, string | undefined>) => Promise<unknown>;
type SiteHandler = (websiteRef: string) => Promise<unknown>;

const RAW_ANALYTICS_WITH_QS: [string, QsHandler][] = [
  ["/v1/websites/:website_id/analytics/traffic-summary", analytics.getTrafficSummary.bind(analytics)],
  ["/v1/websites/:website_id/analytics/activity-trends", analytics.getActivityTrends.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-pages", analytics.getPages.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-referrers", analytics.getReferrers.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-sources", analytics.getSources.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-countries", analytics.getCountries.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-browsers", analytics.getBrowsers.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-devices", analytics.getDevices.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-os", analytics.getOperatingSystems.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-resolutions", analytics.getResolutions.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-languages", analytics.getLanguages.bind(analytics)],
  ["/v1/websites/:website_id/analytics/top-cities", analytics.getCities.bind(analytics)],
  ["/v1/websites/:website_id/analytics/hourly-stats", analytics.getHourlyStats.bind(analytics)],
  ["/v1/websites/:website_id/analytics/daily-stats", analytics.getDailyStats.bind(analytics)],
  ["/v1/websites/:website_id/analytics/goals-stats", analytics.getGoals.bind(analytics)],
  ["/v1/websites/:website_id/analytics/custom-events", analytics.getCustomEvents.bind(analytics)],
  ["/v1/websites/:website_id/analytics/visitor-insights", analytics.getVisitorInsights.bind(analytics)],
  ["/v1/websites/:website_id/analytics/geolocation-breakdown", analytics.getGeolocation.bind(analytics)],
];

/** Fixed-window endpoints that genuinely take no options. */
const RAW_ANALYTICS_SITE_ONLY: [string, SiteHandler][] = [
  ["/v1/websites/:website_id/analytics/realtime", analytics.getRealtime.bind(analytics)],
  ["/v1/websites/:website_id/analytics/live-visitors", analytics.getLiveVisitors.bind(analytics)],
];

/**
 * Windowed endpoints that this API deliberately calls with no query parameters,
 * so each falls back to its own default window.
 *
 * Kept separate from `RAW_ANALYTICS_WITH_QS` to preserve existing behaviour: the
 * raw API has never forwarded `?days=` to these three, and moving them into the
 * query table would silently start honouring it — a change to a public API's
 * semantics dressed up as a refactor.
 */
const RAW_ANALYTICS_DEFAULT_WINDOW: [string, QsHandler][] = [
  ["/v1/websites/:website_id/analytics/path-analysis", analytics.getPathAnalysis.bind(analytics)],
  ["/v1/websites/:website_id/analytics/page-utm-breakdown", analytics.getPageUtmBreakdown.bind(analytics)],
  ["/v1/websites/:website_id/analytics/export", analytics.exportEvents.bind(analytics)],
];

for (const [path, fn] of RAW_ANALYTICS_WITH_QS) {
  r.get(path, requireScope("analytics:read"), async (c) => {
    const data = await fn(websiteId(c), rawAnalyticsQs(c));
    return jsonWithMeta(c, data);
  });
}

for (const [path, fn] of RAW_ANALYTICS_SITE_ONLY) {
  r.get(path, requireScope("analytics:read"), async (c) => {
    const data = await fn(websiteId(c));
    return jsonWithMeta(c, data);
  });
}

for (const [path, fn] of RAW_ANALYTICS_DEFAULT_WINDOW) {
  r.get(path, requireScope("analytics:read"), async (c) => {
    // Empty bag, not `rawAnalyticsQs(c)` — see the table's note.
    const data = await fn(websiteId(c), {});
    return jsonWithMeta(c, data);
  });
}

r.get("/v1/websites/:website_id/analytics/dashboard", requireScope("analytics:read"), async (c) => {
  const data = await analytics.getDashboard(websiteId(c), rawAnalyticsQs(c));
  return jsonWithMeta(c, data);
});

r.get("/v1/websites/:website_id/analytics/recent-activity", requireScope("analytics:read"), async (c) => {
  const q = parseQuery(c, rawRecentActivityQuerySchema);
  if (!q.ok) return q.res;
  const data = await analytics.getRecentActivity(websiteId(c), q.data.limit);
  return jsonWithMeta(c, data);
});

r.get("/v1/websites/:website_id/analytics/events", requireScope("analytics:read"), async (c) => {
  const ctx = c.get("rawApi");
  try {
    const q = parseQuery(c, rawEventsQuerySchema);
    if (!q.ok) return q.res;
    const out = await raw.rawAnalyticsEvents(ports, ctx.websiteId, {
      from: q.data.from || undefined,
      to: q.data.to || undefined,
      limit: q.data.limit,
      offset: q.data.offset,
      event_type: q.data.event_type || undefined,
    });
    return c.json({
      meta: {
        website_id: ctx.websiteId,
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

r.get("/v1/websites/:website_id/sessions", requireScope("replays:read"), async (c) => {
  const ctx = c.get("rawApi");
  const q = parseQuery(c, rawSessionsQuerySchema);
  if (!q.ok) return q.res;
  const { limit, offset } = q.data;
  const out = await raw.rawSessions(ports, ctx.websiteId, limit, offset);
  return c.json({
    meta: { website_id: ctx.websiteId, limit: out.limit, offset: out.offset },
    sessions: out.sessions,
  });
});

r.get("/v1/websites/:website_id/heatmap/pages", requireScope("heatmaps:read"), async (c) => {
  const ctx = c.get("rawApi");
  const out = await raw.rawHeatmapPages(ports, ctx.websiteId);
  return c.json({
    meta: { website_id: ctx.websiteId },
    pages: out.pages,
  });
});

/**
 * Aggregated heatmap cells for one page.
 *
 * `x_percent` / `y_percent` are scaled integers, not percentages, and the scale depends
 * on `event_type`: divide by 10000 for `click`, by 100 for `scroll` (whose `x_percent`
 * is always 0). A click at the centre of a page reads as 5000. The names are a published
 * contract and are kept as-is; see `HeatmapPointOut` for the full note.
 */
r.get("/v1/websites/:website_id/heatmap/points", requireScope("heatmaps:read"), async (c) => {
  const ctx = c.get("rawApi");
  const q = parseQuery(c, rawHeatmapPointsQuerySchema);
  if (!q.ok) return q.res;
  const out = await raw.rawHeatmapPoints(ports, ctx.websiteId, q.data.page_path, q.data.event_type);
  return c.json({
    meta: {
      website_id: ctx.websiteId,
      page_path: out.page_path,
      event_type: out.event_type,
    },
    points: out.points,
  });
});

return r;
}
