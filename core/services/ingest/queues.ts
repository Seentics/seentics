import type { AppConfig } from "../../config";
import { getHeatmapEngine } from "../../lib/heatmap-engine";
import { log } from "../../lib/logger";
import { getReplayEngine } from "../../lib/replay-engine";
import type {
  AnalyticsIngestEvent,
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../../lib/types";
import { ingestAnalyticsBatch } from "./analytics-batch";
import { ingestAutomationTriggersBatch } from "./automation-batch";

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

  await Promise.all(
    [...evMap.entries()].map(async ([siteId, events]) => {
      if (!events.length) return;
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
    }),
  );

  await Promise.all(
    [...funnelMap.entries()].map(async ([siteId, events]) => {
      if (!events.length) return;
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
    }),
  );

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
  cur.push(...events);
  eventsBySite.set(siteId, cur);
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
  cur.push(...events);
  funnelsBySite.set(siteId, cur);
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
