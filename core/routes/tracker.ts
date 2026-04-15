import { gunzipSync } from "node:zlib";
import { Hono } from "hono";
import type { Context } from "hono";
import { env } from "../config";
import type { TrackerCollectBody } from "../lib/api-types";
import {
  flushIngestQueuesNow,
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
 * Background flush (~1s by default) runs batched DB / S3 work — see `services/ingest.service`.
 */
trackerRoutes.post("/collect", async (c) => {
  const cfg = env();
  let body: TrackerCollectBody;
  try {
    body = (await readJsonBody(c)) as TrackerCollectBody;
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
    return c.body(null, 204);
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
  if (lenEvents === 0 && n > 0) {
    log.warn({
      msg: "tracker_collect_no_events_array",
      website_uuid: website.id,
      site_id: website.site_id,
      note: "Payload has session/heatmaps/etc. but no `events` — dashboard pageviews only grow when `events` includes pageview rows.",
      len_session: lenSession,
    });
  }

  handleEvents(ctx);
  handleFunnels(ctx);
  handleAutomations(ctx);
  handleRecordings(ctx);
  handleHeatmaps(ctx);

  await flushIngestQueuesNow();

  log.debug({
    msg: "tracker_collect_flushed",
    website_uuid: website.id,
    site_id: website.site_id,
  });

  return c.body(null, 204);
});
