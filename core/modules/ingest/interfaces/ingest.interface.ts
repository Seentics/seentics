import type { HeatmapTrackerEvent } from "../../heatmaps/interfaces";
import type { VisitorProfileWrite } from "../../automations/interfaces";
import type {
  AutomationTriggerQueued,
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
 * It also closes a real coupling problem. The flush path used to call
 * `getReplayEngine()` and `getHeatmapEngine()` — module-level singleton getters —
 * and `ModuleIngestSinks` imported the analytics and automations batch
 * repositories outright, so ingest had compile-time edges into four modules'
 * internals and could not be tested without them. Every one of the four is now a
 * port implemented by the module that owns the data, so the same code runs against
 * fakes.
 *
 * Every method must be safe to call concurrently with the others; the flush runs
 * all five branches in parallel.
 */
export interface IngestSinks {
  /**
   * Persist a site's analytics rows. Returns the number actually inserted, which can be
   * lower than the input after filtering, and 0 for a batch already applied.
   *
   * A throw here is retried — see `MAX_FLUSH_ATTEMPTS` in the queue service. That retry
   * is only safe because `batchId` makes the write idempotent: the target tables are not.
   */
  writeAnalyticsBatch(
    batchId: string,
    websiteId: string,
    /** Raw tracker events; analytics maps them to its own row shape. */
    events: readonly TrackerEvent[],
  ): Promise<number>;

  /** Persist queued automation triggers. */
  writeAutomationTriggers(batchId: string, rows: AutomationTriggerQueued[]): Promise<void>;

  /** Hand raw tracker events to the session-recording engine. */
  processRecordings(batchId: string, events: TrackerEvent[]): Promise<void>;

  /** Hand raw tracker events to the heatmap engine, which projects and filters them. */
  processHeatmaps(batchId: string, events: readonly HeatmapTrackerEvent[]): Promise<void>;

  /**
   * Persist visitor profiles built from a `/collect` batch.
   *
   * Batched like the rest, and for the same reason plus one: `visit_count` and
   * `total_page_views` accumulate, so this is one of the three writes where a redelivery
   * inflates a number rather than duplicating a row.
   */
  writeVisitorProfiles(batchId: string, rows: readonly VisitorProfileWrite[]): Promise<number>;
}

/**
 * Buffering for the `/collect` path.
 *
 * Enqueues are synchronous and deliberately cheap: the HTTP handler must return
 * without waiting on a database or S3, so the request pays for a push and nothing
 * more. Durability is traded away for that — see `IngestFlusher`.
 */
export interface IngestQueue {
  /**
   * Raw tracker events, with `ingestMeta` already attached per event.
   *
   * Raw rather than `analytics_events`' projection: the buffer becomes a durable queue row,
   * so whatever shape it holds is a stored contract. Analytics projects at apply time.
   */
  enqueueEvents(websiteId: string, events: TrackerEvent[]): void;
  enqueueFunnels(websiteId: string, events: TrackerEvent[]): void;
  enqueueRecordings(events: TrackerEvent[]): void;
  enqueueHeatmaps(events: HeatmapTrackerEvent[]): void;
  enqueueAutomations(rows: AutomationTriggerQueued[]): void;
  /**
   * One visitor profile per `/collect`, coalesced per visitor at flush time.
   *
   * Here rather than written directly because it is a database write, and the whole point
   * of this interface is that `/collect` makes none. It was the one exception, at one
   * un-awaited upsert per request; the tracker flushes every five seconds per visitor, so
   * the exception was also the highest-frequency write in the system.
   */
  enqueueProfiles(rows: VisitorProfileWrite[]): void;
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
    profiles: number;
  };
}

/** The six write paths a batch can belong to. Also the queue's partitioning unit. */
export type IngestCategory =
  | "analytics"
  | "funnels"
  | "automations"
  | "recordings"
  | "heatmaps"
  | "profiles";

/** A batch as it comes back off the durable queue. */
export type QueuedBatch = {
  batchId: string;
  category: IngestCategory;
  /** Session id for recordings, website id otherwise — see `ingest_batches`. */
  partitionKey: string;
  payload: Record<string, unknown>;
  rowCount: number;
  /** Failed attempts so far. At the cap the batch is parked rather than dropped. */
  attempts: number;
};

/**
 * The queue as the worker sees it.
 *
 * An interface so the worker's claim/apply/park logic — the part actually worth testing —
 * can run against an in-memory double. `postgresBatchQueue` is the production
 * implementation, kept in a separate file so importing the worker does not require a
 * database connection. Same split, and same reason, as `OutboxStore`.
 */
export interface BatchQueueStore {
  enqueue(batch: {
    batchId: string;
    category: IngestCategory;
    partitionKey: string;
    payload: Record<string, unknown>;
    rowCount: number;
  }): Promise<void>;

  claimPending(
    category: IngestCategory,
    limit: number,
    maxAttempts: number,
  ): Promise<QueuedBatch[]>;

  markCompleted(batchId: string): Promise<void>;
  markFailed(batchId: string, error: string): Promise<void>;
  /**
   * Hand back batches that were claimed but never applied, without counting an attempt.
   *
   * A claim is a written lease, so a worker that stops mid-drain would otherwise strand
   * every batch it had claimed — and, because at most one batch per partition key is in
   * flight, everything queued behind those keys with them — until the lease expired.
   */
  releaseClaims(batchIds: string[]): Promise<void>;
  countPending(category: IngestCategory, maxAttempts: number): Promise<number>;
  countParked(maxAttempts: number): Promise<number>;
  pruneCompleted(olderThan: Date): Promise<number>;
}
