import type {
  AnalyticsIngestEvent,
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../../../platform/lib/types";

/**
 * The ingest module's public surface.
 *
 * Ingest is the write half of the product: the tracker posts a mixed batch to
 * `/collect`, ingest sorts it by category, buffers it, and flushes to whichever
 * module owns that data. It therefore depends on more modules than anything else
 * here, which is exactly why those dependencies are declared as ports rather than
 * imported — see `IngestSinks`.
 */

/**
 * Where a flushed batch goes.
 *
 * This is the seam that lets ingest stay ignorant of analytics, automations,
 * recordings and heatmaps. Each downstream module supplies its own implementation
 * at composition time.
 *
 * It also closes a real coupling problem: the flush path used to call
 * `getReplayEngine()` and `getHeatmapEngine()` — module-level singleton getters —
 * so ingest reached into two other modules' lifecycles and could not be tested
 * without them. Injected, the same code runs against fakes.
 *
 * Every method must be safe to call concurrently with the others; the flush runs
 * all five branches in parallel.
 */
export interface IngestSinks {
  /**
   * Persist a site's analytics rows. Returns the number actually inserted, which
   * can be lower than the input after de-duplication.
   *
   * A throw here is retried — see `MAX_FLUSH_ATTEMPTS` in the queue service — so
   * this must not partially commit and then throw, or the retry double-writes.
   */
  writeAnalyticsBatch(siteId: string, events: AnalyticsIngestEvent[]): Promise<number>;

  /** Persist queued automation triggers. */
  writeAutomationTriggers(rows: AutomationTriggerQueued[]): Promise<void>;

  /** Hand raw tracker events to the session-recording engine. */
  processRecordings(events: TrackerEvent[]): Promise<void>;

  /** Hand click/scroll/snapshot events to the heatmap engine. */
  processHeatmaps(events: HeatmapIngestEvent[]): Promise<void>;
}

/**
 * Buffering for the `/collect` path.
 *
 * Enqueues are synchronous and deliberately cheap: the HTTP handler must return
 * without waiting on a database or S3, so the request pays for a push and nothing
 * more. Durability is traded away for that — see `IngestFlusher`.
 */
export interface IngestQueue {
  enqueueEvents(siteId: string, events: AnalyticsIngestEvent[]): void;
  enqueueFunnels(siteId: string, events: AnalyticsIngestEvent[]): void;
  enqueueRecordings(events: TrackerEvent[]): void;
  enqueueHeatmaps(events: HeatmapIngestEvent[]): void;
  enqueueAutomations(rows: AutomationTriggerQueued[]): void;
}

/**
 * Lifecycle for the background flush.
 *
 * **The durability trade-off is here.** Buffers live in memory, so anything not yet
 * flushed is lost if the process dies — which is why `flushNow` exists and why
 * shutdown must await it. Moving the buffer to a durable queue (Kafka/Redpanda) is
 * the fix if that loss ever stops being acceptable; nothing above this interface
 * would need to change.
 */
export interface IngestFlusher {
  /** Start the interval timer. Idempotent. */
  start(): void;

  /** Stop the timer. Does not drain — call `flushNow` for that. */
  stop(): void;

  /** Drain every buffer. Call before process exit and before engine shutdown. */
  flushNow(): Promise<void>;

  /** Queue depths, for health checks and diagnostics. */
  depth(): {
    events: number;
    funnels: number;
    recordings: number;
    heatmaps: number;
    automations: number;
  };
}
