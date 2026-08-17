import type { TrackerCollectBody } from "../../lib/api-types";
import type { AnalyticsIngestMeta } from "../../lib/analytics-ingest-meta";
import type { WebsiteTrackerRow } from "../../lib/website-for-tracker";
import type {
  AnalyticsIngestEvent,
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../../lib/types";
import { clampClientTs } from "../../lib/client-timestamp";
import { TRACKER_FUNNEL_EVENT_TYPES } from "../funnels.service";
import {
  enqueueAutomations,
  enqueueEvents,
  enqueueFunnels,
  enqueueHeatmaps,
  enqueueRecordings,
} from "./queues";
import { log as baseLog } from "../../lib/logger";

const log = baseLog.child({ category: "ingest" });

const ROUTED_TO_AUTOMATIONS = new Set(["automation_trigger"]);

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return uuidRe.test(s);
}

/** Parse a client ts (number or numeric string) and clamp it to the server sanity window. */
function flexTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return clampClientTs(Math.trunc(v));
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return clampClientTs(Math.trunc(n));
  }
  return Date.now();
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

function collectPrepareSessions(
  evs: TrackerEvent[],
  siteId: string,
  ingestMeta: AnalyticsIngestMeta,
): TrackerEvent[] {
  const out: TrackerEvent[] = [];
  for (const e of evs) {
    if (e.type !== "rrweb" && e.type !== "session_error" && e.type !== "console_event" && e.type !== "network_event") continue;
    if (!e.sid) continue;
    out.push({ ...e, websiteId: siteId, data: e.data ?? {}, ingestMeta });
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
  heatmapLayoutEnabled: boolean,
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
      heatmapLayoutEnabled,
      clientUa: clientUA,
      docW: e.doc_w,
      docH: e.doc_h,
    });
  }
  return out;
}

function collectPrepareDomSnapshots(
  evs: TrackerEvent[],
  websiteUuid: string,
  siteId: string,
  heatmapLayoutEnabled: boolean,
  clientUA: string,
): HeatmapIngestEvent[] {
  const out: HeatmapIngestEvent[] = [];
  for (const e of evs) {
    if (e.type !== "heatmap_dom_snapshot") continue;
    out.push({
      type: "heatmap_dom_snapshot",
      data: e.data ?? {},
      ts: e.ts,
      url: e.url,
      sid: e.sid,
      vid: e.vid,
      websiteId: websiteUuid,
      siteId,
      heatmapLayoutEnabled,
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

/** Attach `ctx.ingestMeta` (geo + device from /collect) to each event and queue for DB insert. */
export function handleEvents(ctx: CollectHandlerContext): void {
  const page = parseCollectEvents(Array.isArray(ctx.body.events) ? ctx.body.events : []);
  const filtered = page.filter(
    (e) => !TRACKER_FUNNEL_EVENT_TYPES.has(e.type) && !ROUTED_TO_AUTOMATIONS.has(e.type),
  );
  if (!filtered.length) return;
  const forDb = trackerRowsToAnalytics(sortByTs(filtered), ctx.ingestMeta);
  enqueueEvents(ctx.website.site_id, forDb);
  log.debug({ msg: "events_queued", site_id: ctx.website.site_id, n: forDb.length });
}

export function handleFunnels(ctx: CollectHandlerContext): void {
  if (!ctx.website.funnel_enabled) return;
  const raw = parseCollectEvents(Array.isArray(ctx.body.funnels) ? ctx.body.funnels : []);
  const only = raw.filter((e) => TRACKER_FUNNEL_EVENT_TYPES.has(e.type) && e.sid);
  if (!only.length) return;
  const forDb = trackerRowsToAnalytics(sortByTs(only), ctx.ingestMeta);
  enqueueFunnels(ctx.website.site_id, forDb);
  log.debug({ msg: "funnel_events_queued", site_id: ctx.website.site_id, n: forDb.length });
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
    const ts = clampClientTs(e.ts);
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
  if (!rows.length) return;
  enqueueAutomations(rows);
  log.debug({ msg: "automation_triggers_queued", website_id: ctx.website.id, n: rows.length });
}

export function handleRecordings(ctx: CollectHandlerContext): void {
  if (!ctx.website.replay_enabled) return;
  const sessions = parseCollectEvents(Array.isArray(ctx.body.session) ? ctx.body.session : []);
  const prepared = sortByTs(collectPrepareSessions(sessions, ctx.website.site_id, ctx.ingestMeta));
  if (!prepared.length) return;
  enqueueRecordings(prepared);
  log.debug({ msg: "recordings_queued", site_id: ctx.website.site_id, n: prepared.length });
}

export function handleHeatmaps(ctx: CollectHandlerContext): void {
  if (!ctx.website.heatmap_enabled) return;
  const heatmaps = parseCollectEvents(Array.isArray(ctx.body.heatmaps) ? ctx.body.heatmaps : []);
  const screenshots = parseCollectEvents(
    Array.isArray(ctx.body.heatmap_screenshot) ? ctx.body.heatmap_screenshot : [],
  );
  const domSnapshots = parseCollectEvents(
    Array.isArray(ctx.body.heatmap_dom_snapshot) ? ctx.body.heatmap_dom_snapshot : [],
  );
  const merged: HeatmapIngestEvent[] = [
    ...collectPrepareHeatmaps(heatmaps, ctx.website.id, ctx.userAgent),
    ...collectPrepareHeatmapScreenshots(
      screenshots,
      ctx.website.id,
      ctx.website.site_id,
      ctx.website.heatmap_layout_enabled,
      ctx.userAgent,
    ),
    ...collectPrepareDomSnapshots(
      domSnapshots,
      ctx.website.id,
      ctx.website.site_id,
      ctx.website.heatmap_layout_enabled,
      ctx.userAgent,
    ),
  ];
  if (!merged.length) return;
  enqueueHeatmaps(sortByTs(merged));
  log.debug({ msg: "heatmaps_queued", website_id: ctx.website.id, n: merged.length });
}
