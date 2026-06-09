import { gunzipSync } from "node:zlib";
import { Hono } from "hono";
import type { Context } from "hono";
import { env } from "../config";
import type { TrackerCollectBody } from "../lib/api-types";
import {
  handleAutomations,
  handleEvents,
  handleFunnels,
  handleHeatmaps,
  handleRecordings,
} from "../services/ingest.service";
import { buildAnalyticsIngestMeta } from "../lib/analytics-ingest-meta";
import { clientIpForIngest } from "../lib/client-ip";
import { log } from "../lib/logger";
import { originFromRequest, validateOriginDomain } from "../lib/origin";
import {
  buildPublicTrackerConfig,
  listTrackerGoals,
  resolveWebsiteForTracker,
} from "../lib/website-for-tracker";
import * as autoSvc from "../services/automations.service";
import * as funnelSvc from "../services/funnels.service";
import * as playwrightSvc from "../services/heatmap-playwright.service";
import { validationErrorResponse } from "../validators/validation";
import { trackerCollectSchema } from "../validators/tracker";

const maxBodyBytes = 52 * 1024 * 1024;
const maxGunzipBytes = 50 * 1024 * 1024;

export const trackerRoutes = new Hono();

async function readJsonBody(c: Pick<Context, "req">): Promise<unknown> {
  const buf = Buffer.from(await c.req.arrayBuffer());
  if (buf.length > maxBodyBytes) {
    throw new Error("body too large");
  }
  const enc = c.req.header("Content-Encoding");
  let raw = buf;
  if (enc?.toLowerCase().includes("gzip")) {
    raw = gunzipSync(buf, { maxOutputLength: maxGunzipBytes });
  }
  return JSON.parse(raw.toString("utf8")) as unknown;
}

trackerRoutes.get("/init/:website_id", async (c) => {
  const cfg = env();
  const websiteId = c.req.param("website_id");
  const origin = originFromRequest(c.req.raw.headers);

  const website = await resolveWebsiteForTracker(websiteId);
  if (!website || !website.is_active) {
    return c.json({ error: "website not found or inactive" }, 404);
  }
  if (!validateOriginDomain(origin, website.url, cfg.environment)) {
    return c.json({ error: "domain mismatch" }, 403);
  }

  let goals: Awaited<ReturnType<typeof listTrackerGoals>> = [];
  try {
    goals = await listTrackerGoals(website.id);
  } catch {
    goals = [];
  }

  const config = await buildPublicTrackerConfig(website, goals);
  let funnelData: unknown[] = [];
  let automationData: unknown[] = [];
  try {
    funnelData = await funnelSvc.activeForTracker(website.id, origin);
  } catch {
    funnelData = [];
  }
  try {
    const rows = await autoSvc.activeForTracker(website.id);
    automationData = rows.map((a) => ({
      id: a.id,
      name: a.name,
      ...a.definition,
    }));
  } catch {
    automationData = [];
  }
  c.header("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
  return c.json({
    config,
    funnels: funnelData,
    automations: automationData,
  });
});

trackerRoutes.get("/config/:website_id", async (c) => {
  const cfg = env();
  const websiteId = c.req.param("website_id");
  const origin = originFromRequest(c.req.raw.headers);

  const website = await resolveWebsiteForTracker(websiteId);
  if (!website || !website.is_active) {
    return c.json({ error: "website not found or inactive" }, 404);
  }
  if (!validateOriginDomain(origin, website.url, cfg.environment)) {
    return c.json({ error: "domain mismatch" }, 403);
  }

  let goals: Awaited<ReturnType<typeof listTrackerGoals>> = [];
  try {
    goals = await listTrackerGoals(website.id);
  } catch {
    goals = [];
  }

  const config = await buildPublicTrackerConfig(website, goals);
  c.header("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
  return c.json(config);
});

/**
 * Accepts tracker batches, enqueues by kind (events, funnels, automations, recordings, heatmaps).
 * Background flush (~1s by default) runs batched DB / S3 work — see `services/ingest/`.
 */
trackerRoutes.post("/collect", async (c) => {
  const cfg = env();
  let body: TrackerCollectBody;
  try {
    const raw = await readJsonBody(c);
    const parsed = trackerCollectSchema.safeParse(raw);
    if (!parsed.success) return validationErrorResponse(c, parsed.error);
    body = parsed.data as unknown as TrackerCollectBody;
  } catch {
    return c.json({ error: "invalid request body" }, 400);
  }

  const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
  if (!websiteId) {
    return c.json({ error: "website_id is required" }, 400);
  }

  const n =
    (Array.isArray(body.events) ? body.events.length : 0) +
    (Array.isArray(body.session) ? body.session.length : 0) +
    (Array.isArray(body.heatmaps) ? body.heatmaps.length : 0) +
    (Array.isArray(body.heatmap_screenshot) ? body.heatmap_screenshot.length : 0) +
    (Array.isArray(body.funnels) ? body.funnels.length : 0) +
    (Array.isArray(body.automations) ? body.automations.length : 0);

  if (n === 0) {
    return c.json({ status: "ok", message: "nothing to process" }, 200);
  }

  const website = await resolveWebsiteForTracker(websiteId);
  if (!website || !website.is_active) {
    return c.json({ error: "website not found or inactive" }, 404);
  }

  const origin = originFromRequest(c.req.raw.headers);
  if (!validateOriginDomain(origin, website.url, cfg.environment)) {
    return c.json({ error: "domain mismatch" }, 403);
  }

  const ua = c.req.header("User-Agent") ?? "";
  // One enrichment blob per /collect: client IP → MaxMind (country/region/city) + UA/device + optional edge/fallback headers.
  // handleEvents / handleFunnels attach this same ingestMeta to every row before enqueue → flush → Postgres.
  const ingestMeta = buildAnalyticsIngestMeta({
    userAgent: ua,
    clientIp: clientIpForIngest(c, cfg.trustProxy, cfg.isProduction),
    acceptLanguage: c.req.header("Accept-Language") ?? "",
    headers: c.req.raw.headers,
  });
  const ctx = { body, website, userAgent: ua, ingestMeta };

  const lenEvents = Array.isArray(body.events) ? body.events.length : 0;
  const lenSession = Array.isArray(body.session) ? body.session.length : 0;
  const lenHeat = Array.isArray(body.heatmaps) ? body.heatmaps.length : 0;
  const lenHeatShot = Array.isArray(body.heatmap_screenshot) ? body.heatmap_screenshot.length : 0;
  const lenFunnels = Array.isArray(body.funnels) ? body.funnels.length : 0;
  const lenAuto = Array.isArray(body.automations) ? body.automations.length : 0;
  const eventTypesSample =
    lenEvents > 0 && Array.isArray(body.events)
      ? [
          ...new Set(
            body.events
              .slice(0, 40)
              .map((x) => (x && typeof x === "object" && "type" in x ? String((x as { type?: string }).type ?? "") : ""))
              .filter(Boolean),
          ),
        ].slice(0, 15)
      : [];

  const collectFields = {
    msg: "tracker_collect" as const,
    website_param: websiteId,
    website_uuid: website.id,
    site_id: website.site_id,
    origin,
    len_events: lenEvents,
    len_session: lenSession,
    len_heatmaps: lenHeat,
    len_heatmap_screenshot: lenHeatShot,
    len_funnels: lenFunnels,
    len_automations: lenAuto,
    event_types_sample: eventTypesSample,
  };
  log.debug(collectFields);
  if (cfg.diagnosticLog) {
    log.info(collectFields);
  }

  handleEvents(ctx);
  handleFunnels(ctx);
  handleAutomations(ctx);
  handleRecordings(ctx);
  handleHeatmaps(ctx);

  return c.json({ status: "ok", message: "processed", queued: n }, 200);
});

/**
 * POST /api/v1/tracker/request-screenshot
 * Called by seentics.js when a visitor lands on a page with no screenshot yet.
 * Validates origin + websiteId like other tracker endpoints (no auth required).
 * Responds 202 immediately; Playwright capture runs in background (fire-and-forget).
 * Server-side deduplication (cache → DB → Playwright) ensures the browser only
 * launches when no screenshot already exists for this page.
 */
trackerRoutes.post("/request-screenshot", async (c) => {
  const cfg = env();

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
  if (!websiteId) return c.json({ error: "website_id required" }, 400);

  const pageUrl = typeof body.page_url === "string" ? body.page_url.trim() : "";
  const pagePath = typeof body.page_path === "string" ? body.page_path.trim() : "";
  if (!pageUrl || !pagePath) return c.json({ error: "page_url and page_path required" }, 400);

  try {
    new URL(pageUrl);
  } catch {
    return c.json({ error: "invalid page_url" }, 400);
  }

  const website = await resolveWebsiteForTracker(websiteId);
  if (!website || !website.is_active) {
    return c.json({ error: "website not found or inactive" }, 404);
  }

  const origin = originFromRequest(c.req.raw.headers);
  if (!validateOriginDomain(origin, website.url, cfg.environment)) {
    return c.json({ error: "domain mismatch" }, 403);
  }

  void playwrightSvc
    .captureHeatmapScreenshot(websiteId, { pageUrl, pagePath, force: false }, { lenientResolve: true })
    .catch(() => { /* best-effort */ });

  return c.json({ status: "queued" }, 202);
});
