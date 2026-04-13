import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { AppConfig } from "../config";
import { analyticsEvents, automationEvents, automations, db } from "../db";
import type { TrackerCollectBody } from "../lib/api-types";
import { getHeatmapEngine } from "../lib/heatmap-engine";
import { getReplayEngine } from "../lib/replay-engine";
import type {
  AnalyticsIngestEvent,
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../lib/types";
import type { AnalyticsIngestMeta } from "../lib/analytics-ingest-meta";
import type { WebsiteTrackerRow } from "../lib/website-for-tracker";
import { log } from "../lib/logger";
import { TRACKER_FUNNEL_EVENT_TYPES } from "./funnels.service";

// --- Analytics batch (DB insert) ---

const ANALYTICS_SKIP = new Set([
  "rrweb",
  "session_error",
  "heatmap_click",
  "heatmap_scroll",
  "heatmap_screenshot",
  "automation_trigger",
]);

function pickStr(m: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!m) return undefined;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

function pickInt(m: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!m) return undefined;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  }
  return undefined;
}

/** ISO 3166-1 alpha-2 only (matches `analytics_events.country` width). */
function pickIsoCountry2(m: Record<string, unknown> | undefined): string | null {
  const c = pickStr(m, ["country_code", "countryCode"]);
  if (c && /^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  return null;
}

/** Tracker sends `utm: { source, medium, campaign }` from URL params; also accept flat utm_* on `data`. */
function pickUtmColumns(dm: Record<string, unknown> | undefined): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
} {
  let utmSource = pickStr(dm, ["utm_source", "utmSource"]) ?? null;
  let utmMedium = pickStr(dm, ["utm_medium", "utmMedium"]) ?? null;
  let utmCampaign = pickStr(dm, ["utm_campaign", "utmCampaign"]) ?? null;
  const nested = dm?.utm;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const u = nested as Record<string, unknown>;
    utmSource = utmSource ?? pickStr(u, ["source", "utm_source", "utmSource"]) ?? null;
    utmMedium = utmMedium ?? pickStr(u, ["medium", "utm_medium", "utmMedium"]) ?? null;
    utmCampaign = utmCampaign ?? pickStr(u, ["campaign", "utm_campaign", "utmCampaign"]) ?? null;
  }
  return { utmSource, utmMedium, utmCampaign };
}

/** Insert analytics rows from tracker collect (`site_id` = websites.site_id). Returns rows inserted. */
export async function ingestAnalyticsBatch(siteId: string, events: AnalyticsIngestEvent[]): Promise<number> {
  if (!events.length) return 0;
  const now = Date.now();
  const rows: (typeof analyticsEvents.$inferInsert)[] = [];
  for (const e of events) {
    const t = e.type || "event";
    if (ANALYTICS_SKIP.has(t)) continue;
    const dm = e.data ?? {};
    const meta = e.ingestMeta;
    const ref = pickStr(dm, ["referrer", "referer"]);
    const lang =
      pickStr(dm, ["lang", "language"]) ?? meta?.languageHint ?? null;
    const sw = pickInt(dm, ["sw", "screen_width"]);
    const sh = pickInt(dm, ["sh", "screen_height"]);
    const ts = e.ts > 0 ? new Date(e.ts) : new Date(now);
    const utm = pickUtmColumns(dm);
    rows.push({
      websiteSiteId: siteId,
      eventType: t,
      page: e.url ?? "",
      visitorId: e.vid || e.sid || null,
      sessionId: e.sid || null,
      properties: dm,
      referrer: ref ?? null,
      country: meta?.country ?? pickIsoCountry2(dm) ?? null,
      region: meta?.region ?? pickStr(dm, ["region", "region_name", "state"]) ?? null,
      city: meta?.city ?? pickStr(dm, ["city"]) ?? null,
      browser: meta?.browser ?? pickStr(dm, ["browser"]) ?? null,
      device: meta?.device ?? pickStr(dm, ["device", "device_type"]) ?? null,
      os: meta?.os ?? pickStr(dm, ["os", "os_name"]) ?? null,
      language: lang ?? null,
      screenWidth: sw ?? null,
      screenHeight: sh ?? null,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      occurredAt: ts,
    });
  }
  if (!rows.length) {
    const types = [...new Set(events.map((ev) => ev.type || "(empty)"))];
    log.warn({
      msg: "analytics_ingest_all_filtered",
      site_id: siteId,
      n_in: events.length,
      event_types: types.slice(0, 25),
    });
    return 0;
  }
  await db.insert(analyticsEvents).values(rows);
  log.debug({
    msg: "analytics_ingest_inserted",
    site_id: siteId,
    rows: rows.length,
    pageviews: rows.filter((r) => r.eventType === "pageview").length,
  });
  return rows.length;
}

// --- Automation triggers batch ---

/**
 * Insert tracker-fired automation triggers. Drops unknown automation IDs and rows whose
 * automation is inactive or not on the website.
 */
export async function ingestAutomationTriggersBatch(rows: AutomationTriggerQueued[]): Promise<void> {
  if (!rows.length) return;

  const bySite = new Map<string, AutomationTriggerQueued[]>();
  for (const r of rows) {
    const cur = bySite.get(r.websiteUuid) ?? [];
    cur.push(r);
    bySite.set(r.websiteUuid, cur);
  }

  for (const [websiteUuid, siteRows] of bySite) {
    const idList = [...new Set(siteRows.map((r) => r.automationId))];
    const valid = await db
      .select({ id: automations.id })
      .from(automations)
      .where(
        and(
          eq(automations.websiteId, websiteUuid),
          eq(automations.isActive, true),
          inArray(automations.id, idList),
        ),
      );
    const ok = new Set(valid.map((v) => v.id));
    const inserts = siteRows
      .filter((r) => ok.has(r.automationId))
      .map((r) => {
        const d = r.detail;
        const triggerEvent = typeof d.event === "string" ? d.event : undefined;
        const visitorId = typeof d.visitor_id === "string" ? d.visitor_id : undefined;
        const sessionId = typeof d.session_id === "string" ? d.session_id : undefined;
        const pageUrl = typeof d.url === "string" ? d.url : undefined;
        return {
          automationId: r.automationId,
          recordType: "client_trigger",
          runId: randomUUID(),
          triggerEvent,
          status: "triggered",
          visitorId,
          sessionId,
          pageUrl,
          detail: r.detail,
          createdAt: r.occurredAt,
        };
      });
    if (!inserts.length) continue;
    await db.insert(automationEvents).values(inserts);
  }
}

// --- In-memory queues + flush ---

let eventsBySite = new Map<string, AnalyticsIngestEvent[]>();
let funnelsBySite = new Map<string, AnalyticsIngestEvent[]>();
let recordingsQueue: TrackerEvent[] = [];
let heatmapsQueue: HeatmapIngestEvent[] = [];
let automationsQueue: AutomationTriggerQueued[] = [];

let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushMs = 1000;
let maxEventsBeforeForceFlush = 50_000;
let maxRecordingsBeforeForceFlush = 50_000;
let maxHeatmapsBeforeForceFlush = 25_000;
let maxFunnelsBeforeForceFlush = 50_000;
let maxAutomationsBeforeForceFlush = 50_000;

/** Serialize all drains (timer + `/collect`) so a concurrent flush never no-ops and leaves analytics in RAM. */
let flushChain: Promise<void> = Promise.resolve();

function totalQueuedEvents(): number {
  let n = 0;
  for (const evs of eventsBySite.values()) n += evs.length;
  return n;
}

function totalQueuedFunnels(): number {
  let n = 0;
  for (const evs of funnelsBySite.values()) n += evs.length;
  return n;
}

/** Swap in a fresh Map — must not `clear()` the same reference we return (that was dropping all analytics/funnel events). */
function takeEventsSnapshot(): Map<string, AnalyticsIngestEvent[]> {
  const snap = eventsBySite;
  eventsBySite = new Map();
  return snap;
}

function takeFunnelsSnapshot(): Map<string, AnalyticsIngestEvent[]> {
  const snap = funnelsBySite;
  funnelsBySite = new Map();
  return snap;
}

function takeRecordingsSnapshot(): TrackerEvent[] {
  const s = recordingsQueue;
  recordingsQueue = [];
  return s;
}

function takeHeatmapsSnapshot(): HeatmapIngestEvent[] {
  const s = heatmapsQueue;
  heatmapsQueue = [];
  return s;
}

function takeAutomationsSnapshot(): AutomationTriggerQueued[] {
  const s = automationsQueue;
  automationsQueue = [];
  return s;
}

function scheduleFlush(): Promise<void> {
  const run = flushChain.then(() => executeFlush());
  flushChain = run.catch((err: unknown) => {
    log.error({
      msg: "ingest_flush_failed",
      error: err instanceof Error ? err.message : String(err),
    });
  });
  return run;
}

async function executeFlush(): Promise<void> {
  const evMap = takeEventsSnapshot();
  const funnelMap = takeFunnelsSnapshot();
  const rec = takeRecordingsSnapshot();
  const hm = takeHeatmapsSnapshot();
  const autoRows = takeAutomationsSnapshot();

  for (const [siteId, events] of evMap) {
    if (events.length) {
      try {
        const inserted = await ingestAnalyticsBatch(siteId, events);
        log.debug({
          msg: "ingest_flush_events",
          site_id: siteId,
          batch_in: events.length,
          inserted,
        });
        if (inserted > 0) {
          log.info({
            msg: "analytics_rows_persisted",
            site_id: siteId,
            rows: inserted,
          });
        }
      } catch (e) {
        log.error({
          msg: "ingest_analytics_batch_failed",
          site_id: siteId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  for (const [siteId, events] of funnelMap) {
    if (events.length) {
      try {
        const inserted = await ingestAnalyticsBatch(siteId, events);
        log.debug({
          msg: "ingest_flush_funnels",
          site_id: siteId,
          batch_in: events.length,
          inserted,
        });
        if (inserted > 0) {
          log.info({
            msg: "analytics_rows_persisted_funnel",
            site_id: siteId,
            rows: inserted,
          });
        }
      } catch (e) {
        log.error({
          msg: "ingest_funnel_analytics_batch_failed",
          site_id: siteId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  if (rec.length) {
    try {
      await getReplayEngine().processEvents(rec);
      log.debug({ msg: "ingest_flush_recordings", n: rec.length });
    } catch (e) {
      log.error({
        msg: "ingest_recordings_failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (hm.length) {
    try {
      await getHeatmapEngine().processEvents(hm);
      log.debug({ msg: "ingest_flush_heatmaps", n: hm.length });
    } catch (e) {
      log.error({
        msg: "ingest_heatmaps_failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (autoRows.length) {
    try {
      await ingestAutomationTriggersBatch(autoRows);
      log.debug({ msg: "ingest_flush_automations", n: autoRows.length });
    } catch (e) {
      log.error({
        msg: "ingest_automations_failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

export function enqueueEvents(siteId: string, events: AnalyticsIngestEvent[]): void {
  if (!events.length) return;
  const cur = eventsBySite.get(siteId) ?? [];
  eventsBySite.set(siteId, cur.concat(events));
  if (totalQueuedEvents() >= maxEventsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function enqueueRecordings(events: TrackerEvent[]): void {
  if (!events.length) return;
  recordingsQueue.push(...events);
  if (recordingsQueue.length >= maxRecordingsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function enqueueHeatmaps(events: HeatmapIngestEvent[]): void {
  if (!events.length) return;
  heatmapsQueue.push(...events);
  if (heatmapsQueue.length >= maxHeatmapsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function enqueueFunnels(siteId: string, events: AnalyticsIngestEvent[]): void {
  if (!events.length) return;
  const cur = funnelsBySite.get(siteId) ?? [];
  funnelsBySite.set(siteId, cur.concat(events));
  if (totalQueuedFunnels() >= maxFunnelsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function enqueueAutomations(rows: AutomationTriggerQueued[]): void {
  if (!rows.length) return;
  automationsQueue.push(...rows);
  if (automationsQueue.length >= maxAutomationsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function startIngestQueueFlusher(cfg: AppConfig): void {
  flushMs = cfg.ingestQueue.flushMs;
  maxEventsBeforeForceFlush = cfg.ingestQueue.maxEventsBeforeForceFlush;
  maxRecordingsBeforeForceFlush = cfg.ingestQueue.maxRecordingsBeforeForceFlush;
  maxHeatmapsBeforeForceFlush = cfg.ingestQueue.maxHeatmapsBeforeForceFlush;
  maxFunnelsBeforeForceFlush = cfg.ingestQueue.maxFunnelsBeforeForceFlush;
  maxAutomationsBeforeForceFlush = cfg.ingestQueue.maxAutomationsBeforeForceFlush;

  if (flushTimer) return;
  flushTimer = setInterval(() => void scheduleFlush(), flushMs);
}

export function stopIngestQueueFlusher(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/** Drain all pending items (call before process exit / engine shutdown). */
export async function flushIngestQueuesNow(): Promise<void> {
  await scheduleFlush();
}

// --- Tracker collect handlers ---

const ROUTED_TO_AUTOMATIONS = new Set(["automation_trigger"]);

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return uuidRe.test(s);
}

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

export function parseCollectEvents(raw: unknown[]): TrackerEvent[] {
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

function sortByTs<T extends { ts: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.ts - b.ts);
}

function trackerRowsToAnalytics(rows: TrackerEvent[], ingestMeta: AnalyticsIngestMeta): AnalyticsIngestEvent[] {
  return rows.map((e) => ({
    type: e.type,
    data: e.data,
    ts: e.ts,
    url: e.url,
    sid: e.sid,
    vid: e.vid,
    ingestMeta,
  }));
}

export type CollectHandlerContext = {
  body: TrackerCollectBody;
  website: WebsiteTrackerRow;
  userAgent: string;
  ingestMeta: AnalyticsIngestMeta;
};

export function handleEvents(ctx: CollectHandlerContext): void {
  const page = parseCollectEvents(Array.isArray(ctx.body.events) ? ctx.body.events : []);
  const filtered = page.filter(
    (e) => !TRACKER_FUNNEL_EVENT_TYPES.has(e.type) && !ROUTED_TO_AUTOMATIONS.has(e.type),
  );
  if (!filtered.length) return;
  const forDb = trackerRowsToAnalytics(sortByTs(filtered), ctx.ingestMeta);
  enqueueEvents(ctx.website.site_id, forDb);
}

export function handleFunnels(ctx: CollectHandlerContext): void {
  if (!ctx.website.funnel_enabled) return;
  const raw = parseCollectEvents(Array.isArray(ctx.body.funnels) ? ctx.body.funnels : []);
  const only = raw.filter((e) => TRACKER_FUNNEL_EVENT_TYPES.has(e.type) && e.sid);
  if (!only.length) return;
  enqueueFunnels(ctx.website.site_id, trackerRowsToAnalytics(sortByTs(only), ctx.ingestMeta));
}

export function handleAutomations(ctx: CollectHandlerContext): void {
  if (!ctx.website.automation_enabled) return;
  const raw = parseCollectEvents(Array.isArray(ctx.body.automations) ? ctx.body.automations : []);
  const rows: AutomationTriggerQueued[] = [];
  const sorted = sortByTs(raw);
  for (const e of sorted) {
    if (e.type !== "automation_trigger" || !e.sid) continue;
    const dm = e.data ?? {};
    const aid =
      typeof dm.automation_id === "string"
        ? dm.automation_id
        : typeof dm.automationId === "string"
          ? dm.automationId
          : "";
    if (!isUuid(aid)) continue;
    const ts = e.ts > 0 ? e.ts : Date.now();
    const detail: Record<string, unknown> = { url: e.url, session_id: e.sid };
    if (e.vid) detail.visitor_id = e.vid;
    if (typeof dm.name === "string") detail.name = dm.name;
    if (typeof dm.event === "string") detail.event = dm.event;
    if (dm.props && typeof dm.props === "object" && !Array.isArray(dm.props)) {
      detail.props = dm.props;
    }
    rows.push({
      websiteUuid: ctx.website.id,
      automationId: aid,
      occurredAt: new Date(ts),
      detail,
    });
  }
  enqueueAutomations(rows);
}

export function handleRecordings(ctx: CollectHandlerContext): void {
  const sessions = parseCollectEvents(Array.isArray(ctx.body.session) ? ctx.body.session : []);
  const prepared = sortByTs(collectPrepareSessions(sessions, ctx.website.site_id));
  if (!prepared.length) return;
  enqueueRecordings(prepared);
}

export function handleHeatmaps(ctx: CollectHandlerContext): void {
  const heatmaps = parseCollectEvents(Array.isArray(ctx.body.heatmaps) ? ctx.body.heatmaps : []);
  const screenshots = parseCollectEvents(
    Array.isArray(ctx.body.heatmap_screenshot) ? ctx.body.heatmap_screenshot : [],
  );
  const merged: HeatmapIngestEvent[] = [
    ...collectPrepareHeatmaps(heatmaps, ctx.website.id, ctx.userAgent),
    ...collectPrepareHeatmapScreenshots(
      screenshots,
      ctx.website.id,
      ctx.website.site_id,
      ctx.userAgent,
    ),
  ];
  if (!merged.length) return;
  enqueueHeatmaps(sortByTs(merged));
}
