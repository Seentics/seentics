import type { AppConfig } from "../../config";
import { getHeatmapEngine } from "../../lib/heatmap-engine";
import { log as baseLog } from "../../lib/logger";
import { getReplayEngine } from "../../lib/replay-engine";

const log = baseLog.child({ category: "ingest" });
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

/**
 * Hard per-category cap = 2× the force-flush threshold; enqueues beyond it are
 * dropped (and counted) so a stalled/failing flush can't grow the queues unbounded.
 */
const QUEUE_HARD_CAP_MULTIPLIER = 2;

/** Running counters — replaces the O(#sites) scan on every enqueue. */
let queuedEventsCount = 0;
let queuedFunnelsCount = 0;

/** Per-site failed-flush attempts; after MAX_FLUSH_ATTEMPTS the snapshot is dropped. */
const MAX_FLUSH_ATTEMPTS = 3;
const eventsFlushAttempts = new Map<string, number>();
const funnelsFlushAttempts = new Map<string, number>();

/** Swap in a fresh Map — must not `clear()` the same reference we return (that was dropping all analytics/funnel events). */
function takeEventsSnapshot(): Map<string, AnalyticsIngestEvent[]> {
  const snap = eventsBySite;
  eventsBySite = new Map();
  queuedEventsCount = 0;
  return snap;
}

function takeFunnelsSnapshot(): Map<string, AnalyticsIngestEvent[]> {
  const snap = funnelsBySite;
  funnelsBySite = new Map();
  queuedFunnelsCount = 0;
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

function totalOf(map: Map<string, AnalyticsIngestEvent[]>): number {
  let n = 0;
  for (const evs of map.values()) n += evs.length;
  return n;
}

/**
 * A failed insert must not silently discard the snapshot: re-prepend it to the live
 * queue and retry on the next flush, up to MAX_FLUSH_ATTEMPTS, then drop with a count.
 * Bounded because enqueues past the hard cap are rejected while the rows sit requeued.
 */
function requeueFailedAnalytics(
  msg: string,
  attemptsBySite: Map<string, number>,
  liveMap: Map<string, AnalyticsIngestEvent[]>,
  siteId: string,
  events: AnalyticsIngestEvent[],
  err: unknown,
): void {
  const error = err instanceof Error ? err.message : String(err);
  const attempts = (attemptsBySite.get(siteId) ?? 0) + 1;
  if (attempts >= MAX_FLUSH_ATTEMPTS) {
    attemptsBySite.delete(siteId);
    log.error({ msg, site_id: siteId, attempts, dropped: events.length, error });
    return;
  }
  attemptsBySite.set(siteId, attempts);
  const cur = liveMap.get(siteId);
  liveMap.set(siteId, cur?.length ? [...events, ...cur] : events);
  log.error({ msg, site_id: siteId, attempt: attempts, requeued: events.length, error });
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

  // All five branches are independent — run them in parallel.
  await Promise.all([
    // Analytics: one concurrent insert per site
    ...[...evMap.entries()].map(async ([siteId, events]) => {
      if (!events.length) return;
      try {
        const inserted = await ingestAnalyticsBatch(siteId, events);
        eventsFlushAttempts.delete(siteId);
        log.debug({ msg: "ingest_flush_events", site_id: siteId, batch_in: events.length, inserted });
        if (inserted > 0) log.info({ msg: "analytics_rows_persisted", site_id: siteId, rows: inserted });
      } catch (e) {
        requeueFailedAnalytics("ingest_analytics_batch_failed", eventsFlushAttempts, eventsBySite, siteId, events, e);
        queuedEventsCount = totalOf(eventsBySite);
      }
    }),

    // Funnels: one concurrent insert per site
    ...[...funnelMap.entries()].map(async ([siteId, events]) => {
      if (!events.length) return;
      try {
        const inserted = await ingestAnalyticsBatch(siteId, events);
        funnelsFlushAttempts.delete(siteId);
        log.debug({ msg: "ingest_flush_funnels", site_id: siteId, batch_in: events.length, inserted });
        if (inserted > 0) log.info({ msg: "analytics_rows_persisted_funnel", site_id: siteId, rows: inserted });
      } catch (e) {
        requeueFailedAnalytics("ingest_funnel_analytics_batch_failed", funnelsFlushAttempts, funnelsBySite, siteId, events, e);
        queuedFunnelsCount = totalOf(funnelsBySite);
      }
    }),

    // Recordings
    rec.length
      ? getReplayEngine().processEvents(rec)
          .then(() => log.debug({ msg: "ingest_flush_recordings", n: rec.length }))
          .catch((e: unknown) => log.error({ msg: "ingest_recordings_failed", error: e instanceof Error ? e.message : String(e) }))
      : undefined,

    // Heatmaps
    hm.length
      ? getHeatmapEngine().processEvents(hm)
          .then(() => log.debug({ msg: "ingest_flush_heatmaps", n: hm.length }))
          .catch((e: unknown) => log.error({ msg: "ingest_heatmaps_failed", error: e instanceof Error ? e.message : String(e) }))
      : undefined,

    // Automations
    autoRows.length
      ? ingestAutomationTriggersBatch(autoRows)
          .then(() => log.debug({ msg: "ingest_flush_automations", n: autoRows.length }))
          .catch((e: unknown) => log.error({ msg: "ingest_automations_failed", error: e instanceof Error ? e.message : String(e) }))
      : undefined,
  ]);
}

// Use Array.prototype.push.apply rather than spread (...) to avoid stack overflow
// when the incoming array is large (tens of thousands of events per collect call).
function pushAll<T>(target: T[], src: T[]): void {
  Array.prototype.push.apply(target, src);
}

/** Enforce the hard per-category cap: returns the accepted prefix, logging any drops. */
function acceptUpToCap<T>(src: T[], queued: number, cap: number, msg: string): T[] {
  const room = cap - queued;
  if (room >= src.length) return src;
  const dropped = src.length - Math.max(0, room);
  log.warn({ msg, dropped, queued, cap });
  return room > 0 ? src.slice(0, room) : [];
}

export function enqueueEvents(siteId: string, events: AnalyticsIngestEvent[]): void {
  if (!events.length) return;
  const cap = maxEventsBeforeForceFlush * QUEUE_HARD_CAP_MULTIPLIER;
  const accepted = acceptUpToCap(events, queuedEventsCount, cap, "ingest_events_queue_full_drop");
  if (!accepted.length) return;
  const cur = eventsBySite.get(siteId) ?? [];
  pushAll(cur, accepted);
  eventsBySite.set(siteId, cur);
  queuedEventsCount += accepted.length;
  if (queuedEventsCount >= maxEventsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function enqueueRecordings(events: TrackerEvent[]): void {
  if (!events.length) return;
  const cap = maxRecordingsBeforeForceFlush * QUEUE_HARD_CAP_MULTIPLIER;
  const accepted = acceptUpToCap(events, recordingsQueue.length, cap, "ingest_recordings_queue_full_drop");
  if (!accepted.length) return;
  pushAll(recordingsQueue, accepted);
  if (recordingsQueue.length >= maxRecordingsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function enqueueHeatmaps(events: HeatmapIngestEvent[]): void {
  if (!events.length) return;
  const cap = maxHeatmapsBeforeForceFlush * QUEUE_HARD_CAP_MULTIPLIER;
  const accepted = acceptUpToCap(events, heatmapsQueue.length, cap, "ingest_heatmaps_queue_full_drop");
  if (!accepted.length) return;
  pushAll(heatmapsQueue, accepted);
  if (heatmapsQueue.length >= maxHeatmapsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function enqueueFunnels(siteId: string, events: AnalyticsIngestEvent[]): void {
  if (!events.length) return;
  const cap = maxFunnelsBeforeForceFlush * QUEUE_HARD_CAP_MULTIPLIER;
  const accepted = acceptUpToCap(events, queuedFunnelsCount, cap, "ingest_funnels_queue_full_drop");
  if (!accepted.length) return;
  const cur = funnelsBySite.get(siteId) ?? [];
  pushAll(cur, accepted);
  funnelsBySite.set(siteId, cur);
  queuedFunnelsCount += accepted.length;
  if (queuedFunnelsCount >= maxFunnelsBeforeForceFlush) {
    void scheduleFlush();
  }
}

export function enqueueAutomations(rows: AutomationTriggerQueued[]): void {
  if (!rows.length) return;
  const cap = maxAutomationsBeforeForceFlush * QUEUE_HARD_CAP_MULTIPLIER;
  const accepted = acceptUpToCap(rows, automationsQueue.length, cap, "ingest_automations_queue_full_drop");
  if (!accepted.length) return;
  pushAll(automationsQueue, accepted);
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
