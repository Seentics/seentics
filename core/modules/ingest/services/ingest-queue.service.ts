import { batchIdFor } from "../../../platform/idempotency/batch-id";
import type { AppConfig } from "../../../config";
import { log as baseLog } from "../../../platform/lib/logger";
import type { Logger } from "../../../platform/lib/logger";
import type { VisitorProfileWrite } from "../../automations/interfaces";
import type {
  AnalyticsIngestEvent,
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../../../platform/lib/types";
import type {
  BatchQueueStore,
  IngestCategory,
  IngestFlusher,
  IngestQueue,
} from "../interfaces";

/** Failed flush attempts per site before that site's snapshot is dropped. */
const MAX_FLUSH_ATTEMPTS = 3;

/**
 * Hard per-category cap, as a multiple of the force-flush threshold.
 *
 * Enqueues past it are dropped and counted, so a stalled or failing flush cannot
 * grow the buffers until the process runs out of memory. Bounded rather than
 * unbounded is the deliberate choice: shedding load is recoverable, an OOM kill
 * loses every buffer at once.
 */
const QUEUE_HARD_CAP_MULTIPLIER = 2;

/**
 * Byte ceiling for the heatmap buffer, independent of the event count.
 *
 * A count is a fine proxy for memory everywhere except here. A click is tens of bytes; a
 * `heatmap_screenshot` carries up to 3.5MB of base64 and a `heatmap_dom_snapshot` up to
 * 1.5MB of HTML, and `/collect` accepts five of each per request. Twenty-five thousand
 * events was therefore anything between two megabytes and eighty gigabytes, and the
 * container this runs in is capped at 896MB — so the count-based cap could not prevent the
 * one thing a cap exists to prevent.
 */
const DEFAULT_MAX_HEATMAP_BYTES = 64 * 1024 * 1024;

type Thresholds = {
  flushMs: number;
  events: number;
  recordings: number;
  heatmaps: number;
  funnels: number;
  automations: number;
  profiles: number;
};

const DEFAULT_THRESHOLDS: Thresholds = {
  flushMs: 1000,
  events: 50_000,
  recordings: 50_000,
  heatmaps: 25_000,
  funnels: 50_000,
  automations: 50_000,
  profiles: 20_000,
};

/**
 * In-memory buffering between `/collect` and the modules that own the data.
 *
 * Batching is what makes ingest viable: ten thousand events become a handful of
 * multi-row inserts instead of ten thousand round trips. The HTTP handler pays only
 * for a push, so `/collect` stays fast regardless of how much downstream work the
 * batch eventually causes.
 *
 * **Durability trade-off:** buffers are in memory. Anything unflushed when the
 * process dies is lost. That is acceptable for analytics events and deliberately
 * not how important domain events are handled — those use the transactional outbox.
 * If ingest loss ever stops being acceptable, the buffer moves to a durable queue
 * behind this same interface.
 *
 * Previously a set of module-level `let` bindings and exported functions. As a class
 * with injected sinks it can be instantiated per test with fakes, and it no longer
 * reaches into other modules' singletons to find its write targets.
 */
export class IngestQueueService implements IngestQueue, IngestFlusher {
  private readonly log: Logger;

  // ── Buffers ───────────────────────────────────────────────────────────────
  // Analytics and funnels are keyed by site so each site flushes as its own
  // insert; the other three are flat, and grouped by site at flush time.
  private eventsBySite = new Map<string, AnalyticsIngestEvent[]>();
  private funnelsBySite = new Map<string, AnalyticsIngestEvent[]>();
  private recordingsQueue: TrackerEvent[] = [];
  private heatmapsQueue: HeatmapIngestEvent[] = [];
  private automationsQueue: AutomationTriggerQueued[] = [];
  private profilesQueue: VisitorProfileWrite[] = [];

  /**
   * Running totals for the map-backed buffers.
   *
   * Maintained incrementally rather than summed on demand: the alternative is an
   * O(number of sites) walk on every single enqueue, on the hottest path here.
   */
  private queuedEventsCount = 0;
  private queuedFunnelsCount = 0;

  /** Approximate retained bytes of `heatmapsQueue`. See `DEFAULT_MAX_HEATMAP_BYTES`. */
  private heatmapBytes = 0;
  private maxHeatmapBytes = DEFAULT_MAX_HEATMAP_BYTES;

  /** Consecutive failed flushes per site, for the two retryable branches. */
  private readonly eventsFlushAttempts = new Map<string, number>();
  private readonly funnelsFlushAttempts = new Map<string, number>();

  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private thresholds: Thresholds = { ...DEFAULT_THRESHOLDS };

  /**
   * Serializes every drain, whether from the timer or a force-flush.
   *
   * Without it a flush triggered by a full queue can interleave with the timer's,
   * and the second one takes an empty snapshot while the first still holds the rows
   * — which reads as a successful no-op and leaves data in RAM.
   */
  private flushChain: Promise<void> = Promise.resolve();

  /**
   * The flush already queued behind the running one, if any.
   *
   * Every enqueue past a force-flush threshold asks for a flush, and while the buffer
   * stays above that threshold that is *every enqueue* — so the chain grew one no-op
   * drain per event under exactly the sustained load the threshold exists to handle.
   * One pending flush is enough: it has not started, so it will see everything a later
   * caller would have wanted flushed.
   */
  private pendingFlush: Promise<void> | null = null;

  constructor(
    /**
     * Where a flushed batch is handed off.
     *
     * A queue row, not the sinks: the batch is committed to `ingest_batches` before any
     * module write is attempted, which is what moves the durability boundary in front of
     * these in-memory buffers. `IngestWorker` drains it.
     */
    private readonly queue: BatchQueueStore,
    logger: Logger = baseLog,
  ) {
    this.log = logger.child({ category: "ingest" });
  }

  /** Apply configured thresholds. Safe to call before or after `start`. */
  configure(cfg: AppConfig): void {
    this.thresholds = {
      flushMs: cfg.ingestQueue.flushMs,
      events: cfg.ingestQueue.maxEventsBeforeForceFlush,
      recordings: cfg.ingestQueue.maxRecordingsBeforeForceFlush,
      heatmaps: cfg.ingestQueue.maxHeatmapsBeforeForceFlush,
      funnels: cfg.ingestQueue.maxFunnelsBeforeForceFlush,
      automations: cfg.ingestQueue.maxAutomationsBeforeForceFlush,
      profiles: cfg.ingestQueue.maxProfilesBeforeForceFlush,
    };
    this.maxHeatmapBytes = cfg.ingestQueue.maxHeatmapBytes;
  }

  // ── IngestFlusher ─────────────────────────────────────────────────────────

  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.scheduleFlush(), this.thresholds.flushMs);
  }

  stop(): void {
    if (!this.flushTimer) return;
    clearInterval(this.flushTimer);
    this.flushTimer = null;
  }

  async flushNow(): Promise<void> {
    await this.scheduleFlush();
  }

  depth() {
    return {
      events: this.queuedEventsCount,
      funnels: this.queuedFunnelsCount,
      recordings: this.recordingsQueue.length,
      heatmaps: this.heatmapsQueue.length,
      automations: this.automationsQueue.length,
      profiles: this.profilesQueue.length,
    };
  }

  // ── IngestQueue ───────────────────────────────────────────────────────────

  enqueueEvents(websiteId: string, events: AnalyticsIngestEvent[]): void {
    if (!events.length) return;
    const accepted = this.acceptUpToCap(
      events,
      this.queuedEventsCount,
      this.thresholds.events * QUEUE_HARD_CAP_MULTIPLIER,
      "ingest_events_queue_full_drop",
    );
    if (!accepted.length) return;

    const current = this.eventsBySite.get(websiteId) ?? [];
    pushAll(current, accepted);
    this.eventsBySite.set(websiteId, current);
    this.queuedEventsCount += accepted.length;

    if (this.queuedEventsCount >= this.thresholds.events) void this.scheduleFlush();
  }

  enqueueFunnels(websiteId: string, events: AnalyticsIngestEvent[]): void {
    if (!events.length) return;
    const accepted = this.acceptUpToCap(
      events,
      this.queuedFunnelsCount,
      this.thresholds.funnels * QUEUE_HARD_CAP_MULTIPLIER,
      "ingest_funnels_queue_full_drop",
    );
    if (!accepted.length) return;

    const current = this.funnelsBySite.get(websiteId) ?? [];
    pushAll(current, accepted);
    this.funnelsBySite.set(websiteId, current);
    this.queuedFunnelsCount += accepted.length;

    if (this.queuedFunnelsCount >= this.thresholds.funnels) void this.scheduleFlush();
  }

  enqueueRecordings(events: TrackerEvent[]): void {
    if (!events.length) return;
    const accepted = this.acceptUpToCap(
      events,
      this.recordingsQueue.length,
      this.thresholds.recordings * QUEUE_HARD_CAP_MULTIPLIER,
      "ingest_recordings_queue_full_drop",
    );
    if (!accepted.length) return;

    pushAll(this.recordingsQueue, accepted);
    if (this.recordingsQueue.length >= this.thresholds.recordings) void this.scheduleFlush();
  }

  enqueueHeatmaps(events: HeatmapIngestEvent[]): void {
    if (!events.length) return;

    // Bytes first: one screenshot can be worth ten thousand clicks, and the count cap
    // cannot see the difference.
    const incoming = heatmapBytesOf(events);
    if (this.heatmapBytes + incoming > this.maxHeatmapBytes) {
      this.log.warn({
        msg: "ingest_heatmaps_byte_cap_drop",
        dropped: events.length,
        queued_bytes: this.heatmapBytes,
        cap_bytes: this.maxHeatmapBytes,
      });
      void this.scheduleFlush();
      return;
    }

    const accepted = this.acceptUpToCap(
      events,
      this.heatmapsQueue.length,
      this.thresholds.heatmaps * QUEUE_HARD_CAP_MULTIPLIER,
      "ingest_heatmaps_queue_full_drop",
    );
    if (!accepted.length) return;

    pushAll(this.heatmapsQueue, accepted);
    this.heatmapBytes += heatmapBytesOf(accepted);
    if (this.heatmapsQueue.length >= this.thresholds.heatmaps) void this.scheduleFlush();
  }

  enqueueAutomations(rows: AutomationTriggerQueued[]): void {
    if (!rows.length) return;
    const accepted = this.acceptUpToCap(
      rows,
      this.automationsQueue.length,
      this.thresholds.automations * QUEUE_HARD_CAP_MULTIPLIER,
      "ingest_automations_queue_full_drop",
    );
    if (!accepted.length) return;

    pushAll(this.automationsQueue, accepted);
    if (this.automationsQueue.length >= this.thresholds.automations) void this.scheduleFlush();
  }

  enqueueProfiles(rows: VisitorProfileWrite[]): void {
    if (!rows.length) return;
    const accepted = this.acceptUpToCap(
      rows,
      this.profilesQueue.length,
      this.thresholds.profiles * QUEUE_HARD_CAP_MULTIPLIER,
      "ingest_profiles_queue_full_drop",
    );
    if (!accepted.length) return;

    pushAll(this.profilesQueue, accepted);
    if (this.profilesQueue.length >= this.thresholds.profiles) void this.scheduleFlush();
  }

  // ── Flush ─────────────────────────────────────────────────────────────────

  private scheduleFlush(): Promise<void> {
    // One flush queued behind the running one is enough — see `pendingFlush`.
    if (this.pendingFlush) return this.pendingFlush;

    const run = this.flushChain.then(() => {
      this.pendingFlush = null;
      return this.executeFlush();
    });
    // The chain must never hold a rejected promise, or every later flush inherits
    // the rejection and stops running.
    this.flushChain = run.catch((err: unknown) => {
      this.log.error({ msg: "ingest_flush_failed", error: errText(err) });
    });
    this.pendingFlush = this.flushChain;
    return run;
  }

  private async executeFlush(): Promise<void> {
    const evMap = this.takeEventsSnapshot();
    const funnelMap = this.takeFunnelsSnapshot();
    const recordings = this.takeRecordingsSnapshot();
    const heatmaps = this.takeHeatmapsSnapshot();
    const automations = this.takeAutomationsSnapshot();
    const profiles = this.takeProfilesSnapshot();

    // All branches are independent, so they run concurrently. Each contains its own
    // failures: one sink being down must not stop the others.
    await Promise.all([
      ...[...evMap.entries()].map(([websiteId, events]) =>
        this.flushAnalytics(websiteId, events, "events"),
      ),
      ...[...funnelMap.entries()].map(([websiteId, events]) =>
        this.flushAnalytics(websiteId, events, "funnels"),
      ),
      // Recordings partition by session, so one session's chunks are never applied
      // concurrently — sequences are assigned per session. The rest partition by site.
      ...groupBy(recordings, (ev) => ev.sid ?? "").map(([sessionId, batch]) =>
        this.flushBranch("recordings", batch, (id, rows) =>
          this.enqueue(id, "recordings", sessionId, { events: rows }, rows.length),
        ),
      ),
      // Grouped by website, not flushed as one batch keyed on whichever site happened to
      // be first in the buffer. These buffers are flat and accumulate across every site
      // sending traffic in the same window, so `rows[0].websiteId` named an arbitrary one
      // — and since at most one batch per partition key is in flight, every site's data
      // then queued behind that single arbitrary key.
      ...groupBy(heatmaps, siteOf).map(([websiteId, batch]) =>
        this.flushBranch("heatmaps", batch, (id, rows) =>
          this.enqueue(id, "heatmaps", websiteId, { events: rows }, rows.length),
        ),
      ),
      ...groupBy(automations, siteOf).map(([websiteId, batch]) =>
        this.flushBranch("automations", batch, (id, rows) =>
          this.enqueue(id, "automations", websiteId, { rows }, rows.length),
        ),
      ),
      // Collapsing a visitor's repeats into one row is the sink's job, not this one's:
      // it is a requirement of the upsert rather than a saving — `ON CONFLICT DO UPDATE`
      // cannot touch the same row twice in one statement — and it belongs with the
      // statement that has the constraint.
      ...groupBy(profiles, siteOf).map(([websiteId, batch]) =>
        this.flushBranch("profiles", batch, (id, rows) =>
          this.enqueue(id, "profiles", websiteId, { rows }, rows.length),
        ),
      ),
    ]);
  }

  /**
   * Flush one site's analytics or funnel rows.
   *
   * These two are the only retryable branches, because they are the only ones whose
   * loss is not recoverable from elsewhere: a dropped recording or heatmap point
   * degrades a visualisation, a dropped analytics row corrupts a count.
   */
  private async flushAnalytics(
    websiteId: string,
    events: AnalyticsIngestEvent[],
    kind: "events" | "funnels",
  ): Promise<void> {
    if (!events.length) return;

    const attempts = kind === "events" ? this.eventsFlushAttempts : this.funnelsFlushAttempts;
    const liveMap = kind === "events" ? this.eventsBySite : this.funnelsBySite;

    try {
      // Enqueued rather than written: the worker applies it. `inserted` is the rows
      // accepted onto the queue, which is what this side can honestly report.
      await this.enqueue(
        batchIdFor(events),
        kind === "events" ? "analytics" : "funnels",
        websiteId,
        { websiteId, events },
        events.length,
      );
      const inserted = events.length;
      attempts.delete(websiteId);
      this.log.debug({
        msg: `ingest_flush_${kind}`,
        website_id: websiteId,
        batch_in: events.length,
        inserted,
      });
      if (inserted > 0) {
        this.log.info({
          msg: kind === "events" ? "analytics_rows_persisted" : "analytics_rows_persisted_funnel",
          website_id: websiteId,
          rows: inserted,
        });
      }

      // `analytics.batch_ingested` is published by `IngestWorker`, not here. The event
      // means "rows are in the table", and this side only knows the batch is queued —
      // announcing at this point would have consumers reacting to rows that a parked
      // batch never wrote.
    } catch (err) {
      this.requeueFailedAnalytics(
        kind === "events"
          ? "ingest_analytics_batch_failed"
          : "ingest_funnel_analytics_batch_failed",
        attempts,
        liveMap,
        websiteId,
        events,
        err,
      );
      // Recount rather than adjust: the requeue merged the failed snapshot back
      // into a map that concurrent enqueues may also have grown.
      const total = totalOf(liveMap);
      if (kind === "events") this.queuedEventsCount = total;
      else this.queuedFunnelsCount = total;
    }
  }

  /** Flush a flat branch, logging and swallowing its failures. */
  private async flushBranch<T>(
    name: string,
    batch: T[],
    write: (batchId: string, batch: T[]) => Promise<void>,
  ): Promise<void> {
    if (!batch.length) return;
    try {
      // Derived from the batch's contents, so a redelivery of these exact rows carries
      // the same id and the write can skip it. See `batchIdFor`.
      await write(batchIdFor(batch), batch);
      this.log.debug({ msg: `ingest_flush_${name}`, n: batch.length });
    } catch (err) {
      // Not requeued: these carry no retry counter, and re-adding them on every
      // failure would grow the buffer without bound while the sink stays down.
      this.log.error({ msg: `ingest_${name}_failed`, error: errText(err) });
    }
  }

  /**
   * Put a failed snapshot back at the front of the live queue and retry next flush,
   * up to `MAX_FLUSH_ATTEMPTS`, then drop it with a logged count.
   *
   * Prepended so ordering survives a retry. Dropping eventually is deliberate: a
   * site whose rows never insert would otherwise hold its snapshot forever and
   * block the queue behind the hard cap.
   */
  private requeueFailedAnalytics(
    msg: string,
    attemptsBySite: Map<string, number>,
    liveMap: Map<string, AnalyticsIngestEvent[]>,
    websiteId: string,
    events: AnalyticsIngestEvent[],
    err: unknown,
  ): void {
    const error = errText(err);
    const attempts = (attemptsBySite.get(websiteId) ?? 0) + 1;

    if (attempts >= MAX_FLUSH_ATTEMPTS) {
      attemptsBySite.delete(websiteId);
      this.log.error({ msg, website_id: websiteId, attempts, dropped: events.length, error });
      return;
    }

    attemptsBySite.set(websiteId, attempts);
    const current = liveMap.get(websiteId);
    liveMap.set(websiteId, current?.length ? [...events, ...current] : events);
    this.log.error({ msg, website_id: websiteId, attempt: attempts, requeued: events.length, error });
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────
  // Each swaps in a fresh container and returns the old one. Calling `clear()` on
  // the returned reference instead would empty the very batch being flushed — a
  // bug this code has already had once, which dropped every buffered event.

  private takeEventsSnapshot(): Map<string, AnalyticsIngestEvent[]> {
    const snapshot = this.eventsBySite;
    this.eventsBySite = new Map();
    this.queuedEventsCount = 0;
    return snapshot;
  }

  private takeFunnelsSnapshot(): Map<string, AnalyticsIngestEvent[]> {
    const snapshot = this.funnelsBySite;
    this.funnelsBySite = new Map();
    this.queuedFunnelsCount = 0;
    return snapshot;
  }

  private takeRecordingsSnapshot(): TrackerEvent[] {
    const snapshot = this.recordingsQueue;
    this.recordingsQueue = [];
    return snapshot;
  }

  private takeHeatmapsSnapshot(): HeatmapIngestEvent[] {
    const snapshot = this.heatmapsQueue;
    this.heatmapsQueue = [];
    this.heatmapBytes = 0;
    return snapshot;
  }

  private takeAutomationsSnapshot(): AutomationTriggerQueued[] {
    const snapshot = this.automationsQueue;
    this.automationsQueue = [];
    return snapshot;
  }

  private takeProfilesSnapshot(): VisitorProfileWrite[] {
    const snapshot = this.profilesQueue;
    this.profilesQueue = [];
    return snapshot;
  }

  /** Trim an incoming batch to what the hard cap still allows, logging drops. */
  private acceptUpToCap<T>(src: T[], queued: number, cap: number, msg: string): T[] {
    const room = cap - queued;
    if (room >= src.length) return src;

    const dropped = src.length - Math.max(0, room);
    this.log.warn({ msg, dropped, queued, cap });
    return room > 0 ? src.slice(0, room) : [];
  }

  /**
   * Put one batch on the durable queue.
   *
   * Enqueue is idempotent on the content-derived id, so a flush that writes the row and
   * then fails before clearing its buffer does not queue the batch twice.
   */
  private async enqueue(
    batchId: string,
    category: IngestCategory,
    partitionKey: string,
    payload: Record<string, unknown>,
    rowCount: number,
  ): Promise<void> {
    await this.queue.enqueue({ batchId, category, partitionKey, payload, rowCount });
  }
}

/**
 * Append `src` to `target` in place.
 *
 * `push.apply` rather than spread: a `/collect` call can carry tens of thousands of
 * events, and `push(...src)` puts every one on the argument stack and overflows it.
 */
function pushAll<T>(target: T[], src: T[]): void {
  Array.prototype.push.apply(target, src);
}

function totalOf(map: Map<string, AnalyticsIngestEvent[]>): number {
  let n = 0;
  for (const events of map.values()) n += events.length;
  return n;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Approximate retained bytes of a heatmap batch.
 *
 * Only the two fields that can be large are measured, because only they can be: an image
 * or an HTML snapshot is a top-level string on `data`, and everything else on a heatmap
 * event is a number or a short selector. Walking the whole object with `JSON.stringify`
 * would cost more than the cap saves, on the hot enqueue path.
 */
function heatmapBytesOf(events: readonly HeatmapIngestEvent[]): number {
  let bytes = 0;
  for (const ev of events) {
    const data = ev.data as { image?: unknown; html?: unknown } | undefined;
    if (typeof data?.image === "string") bytes += data.image.length;
    if (typeof data?.html === "string") bytes += data.html.length;
    bytes += 256; // envelope, selector, url
  }
  return bytes;
}

/**
 * Group rows by a key, preserving arrival order within each group.
 *
 * The key decides the queue's `partition_key`, which is what serialises work: recordings
 * key on session because chunk sequences are assigned per session, and everything else
 * keys on website — commutative, so the key exists for fairness rather than ordering.
 * One busy site cannot then monopolise the queue ahead of every other.
 */
function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string): [string, T[]][] {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = byKey.get(key);
    if (group) group.push(row);
    else byKey.set(key, [row]);
  }
  return [...byKey];
}

function siteOf(row: { websiteId?: string }): string {
  return row.websiteId ?? "";
}
