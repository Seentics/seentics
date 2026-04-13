import { gunzipSync } from "node:zlib";
import { Hono } from "hono";
import type { Context } from "hono";
import { env } from "../config";
import type { TrackerCollectBody } from "../lib/api-types";
import { getHeatmapEngine } from "../lib/heatmap-engine";
import { originFromRequest, validateOriginDomain } from "../lib/origin";
import { getReplayEngine } from "../lib/replay-engine";
import type { HeatmapIngestEvent, TrackerEvent } from "../lib/types";
import { ingestAnalyticsBatch } from "../lib/event-ingest";
import {
  buildPublicTrackerConfig,
  getWebsiteTrackerRow,
  listTrackerGoals,
} from "../lib/website-for-tracker";
import * as autoSvc from "../services/automations.service";
import * as funnelSvc from "../services/funnels.service";

const maxBodyBytes = 52 * 1024 * 1024;
const maxGunzipBytes = 50 * 1024 * 1024;

export const trackerRoutes = new Hono();

function flexTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return 0;
}

function asDataMap(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function parseCollectEvents(raw: unknown[]): TrackerEvent[] {
  const out: TrackerEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const type = typeof o.type === "string" ? o.type : "";
    const sid = typeof o.sid === "string" ? o.sid : "";
    const vid = typeof o.vid === "string" ? o.vid : undefined;
    const url = typeof o.url === "string" ? o.url : "";
    let doc_w: number | undefined;
    let doc_h: number | undefined;
    if (typeof o.doc_w === "number" && Number.isFinite(o.doc_w)) doc_w = o.doc_w;
    if (typeof o.doc_h === "number" && Number.isFinite(o.doc_h)) doc_h = o.doc_h;
    out.push({
      type,
      data: asDataMap(o.data),
      ts: flexTs(o.ts),
      url,
      sid,
      vid,
      websiteId: "",
      doc_w,
      doc_h,
    });
  }
  return out;
}

function collectPrepareSessions(evs: TrackerEvent[], siteId: string): TrackerEvent[] {
  const out: TrackerEvent[] = [];
  for (const e of evs) {
    if (e.type !== "" && e.type !== "rrweb" && e.type !== "session_error") continue;
    if (!e.sid) continue;
    out.push({ ...e, websiteId: siteId, data: e.data ?? {} });
  }
  return out;
}

function collectPrepareHeatmaps(
  evs: TrackerEvent[],
  websiteUuid: string,
  clientUA: string,
): HeatmapIngestEvent[] {
  const out: HeatmapIngestEvent[] = [];
  for (const e of evs) {
    if (e.type !== "heatmap_click" && e.type !== "heatmap_scroll") continue;
    out.push({
      type: e.type,
      data: e.data ?? {},
      ts: e.ts,
      url: e.url,
           sid: e.sid,
      vid: e.vid,
      websiteId: websiteUuid,
      clientUa: clientUA,
      docW: e.doc_w,
      docH: e.doc_h,
    });
  }
  return out;
}

function collectPrepareHeatmapScreenshots(
  evs: TrackerEvent[],
  websiteUuid: string,
  siteId: string,
  clientUA: string,
): HeatmapIngestEvent[] {
  const out: HeatmapIngestEvent[] = [];
  for (const e of evs) {
    if (e.type !== "heatmap_screenshot") continue;
    out.push({
      type: "heatmap_screenshot",
      data: e.data ?? {},
      ts: e.ts,
      url: e.url,
      sid: e.sid,
      vid: e.vid,
      websiteId: websiteUuid,
      siteId,
      clientUa: clientUA,
      docW: e.doc_w,
      docH: e.doc_h,
    });
  }
  return out;
}

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

  const w = await getWebsiteTrackerRow(websiteId);
  if (!w || !w.is_active) {
    return c.json({ error: "website not found or domain mismatch" }, 404);
  }
  if (!validateOriginDomain(origin, w.url, cfg.environment)) {
    return c.json({ error: "website not found or domain mismatch" }, 404);
  }

  let goals: Awaited<ReturnType<typeof listTrackerGoals>> = [];
  try {
    goals = await listTrackerGoals(w.id);
  } catch {
    goals = [];
  }

  const config = await buildPublicTrackerConfig(w, goals);
  let funnelData: unknown[] = [];
  let automationData: unknown[] = [];
  try {
    funnelData = await funnelSvc.activeForTracker(websiteId, origin);
  } catch {
    funnelData = [];
  }
  try {
    const rows = await autoSvc.activeForTracker(websiteId);
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

  const w = await getWebsiteTrackerRow(websiteId);
  if (!w || !w.is_active) {
    return c.json({ error: "website not found or domain mismatch" }, 404);
  }
  if (!validateOriginDomain(origin, w.url, cfg.environment)) {
    return c.json({ error: "website not found or domain mismatch" }, 404);
  }

  let goals: Awaited<ReturnType<typeof listTrackerGoals>> = [];
  try {
    goals = await listTrackerGoals(w.id);
  } catch {
    goals = [];
  }

  const config = await buildPublicTrackerConfig(w, goals);
  c.header("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
  return c.json(config);
});

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

  const sessions = parseCollectEvents(Array.isArray(body.session) ? body.session : []);
  const heatmaps = parseCollectEvents(Array.isArray(body.heatmaps) ? body.heatmaps : []);
  const screenshots = parseCollectEvents(
    Array.isArray(body.heatmap_screenshot) ? body.heatmap_screenshot : [],
  );

  const n =
    (Array.isArray(body.events) ? body.events.length : 0) +
    sessions.length +
    heatmaps.length +
    screenshots.length +
    (Array.isArray(body.funnels) ? body.funnels.length : 0) +
    (Array.isArray(body.automations) ? body.automations.length : 0);

  if (n === 0) {
    return c.body(null, 204);
  }

  const w = await getWebsiteTrackerRow(websiteId);
  if (!w || !w.is_active) {
    return c.json({ error: "website not found or inactive" }, 404);
  }

  const origin = originFromRequest(c.req.raw.headers);
  if (!validateOriginDomain(origin, w.url, cfg.environment)) {
    return c.json({ error: "domain mismatch" }, 403);
  }

  const ua = c.req.header("User-Agent") ?? "";

  const replayEvents = collectPrepareSessions(sessions, w.site_id);
  if (replayEvents.length) {
    await getReplayEngine().processEvents(replayEvents);
  }

  const heatmapEvents: HeatmapIngestEvent[] = [
    ...collectPrepareHeatmaps(heatmaps, w.id, ua),
    ...collectPrepareHeatmapScreenshots(screenshots, w.id, w.site_id, ua),
  ];
  if (heatmapEvents.length) {
    await getHeatmapEngine().processEvents(heatmapEvents);
  }

  const pageEvents = parseCollectEvents(Array.isArray(body.events) ? body.events : []);
  const funnelEvents = parseCollectEvents(Array.isArray(body.funnels) ? body.funnels : []);
  if (pageEvents.length || funnelEvents.length) {
    await ingestAnalyticsBatch(w.site_id, [...pageEvents, ...funnelEvents]);
  }

  // `automations` in the collect payload is reserved for future execution hooks (not implemented).

  return c.body(null, 204);
});
