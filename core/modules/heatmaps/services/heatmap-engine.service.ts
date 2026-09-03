import { env } from "../../../config";
import type { EventBus } from "../../../infrastructure/events";
import { batchUpsertPoints } from "../repositories/heatmap-writes.repository";
import type { HeatmapPointRow, ScreenshotJob } from "../../../platform/lib/types";
import { applyBatchOnceSql } from "../../../infrastructure/idempotency";
import type { HeatmapIngest } from "../interfaces";
import { eventsToPoints, eventsToScreenshotJobs } from "./point-mapping";
import { SnapshotIngestService } from "./snapshot-ingest.service";
import { trackerRowsToHeatmapEvents, type HeatmapTrackerEvent } from "./tracker-mapping";
import type { TrackerWebsites } from "../../websites/interfaces";
import { log as baseLog } from "../../../platform/lib/logger";

const log = baseLog.child({ category: "heatmap" });

const pgQueueCap = 50_000;
const pgBatchMs = 400;
const shotQueueCap = 512;
/** Concurrent screenshot uploads, so one slow S3 write does not serialize a drain. */
const shotConcurrency = 3;

/**
 * The tracker ingest path for heatmap data.
 *
 * Buffers points and screenshots and drains them on a timer, so `/collect` never waits on
 * Postgres or S3. That is also why the domain events it publishes are published from the
 * *flush*, not from `processEvents`: enqueuing is not a fact about stored data, and a
 * consumer reacting to an enqueue would sometimes be reacting to rows a later failure
 * dropped.
 *
 * Two things it used to do itself now live beside it: turning events into rows
 * (`point-mapping`, pure and total) and writing page backgrounds to object storage
 * (`SnapshotIngestService`). What is left is the part that is genuinely about being an
 * engine — buffers, caps, a timer, batch-grouped writes and shutdown ordering.
 */
export class HeatmapEngine implements HeatmapIngest {
  /**
   * Buffered points, each tagged with the ingest batch it arrived in.
   *
   * The tag is what makes the additive upsert replay-safe. This engine re-batches on its
   * own timer, so one ingest batch's points can span several flushes and one flush can
   * span several batches — a marker keyed on the flush would be meaningless. Grouping by
   * `batchId` at flush time means each write covers whole batches and can be skipped as a
   * unit on redelivery.
   */
  private pointBuf: (HeatmapPointRow & { batchId: string })[] = [];
  private shotBuf: ScreenshotJob[] = [];
  private pgTimer: ReturnType<typeof setInterval>;
  private readonly snapshots: SnapshotIngestService;

  /**
   * `eventBus` is `null` when the engine was created lazily by `getHeatmapEngine()`
   * rather than through `initHeatmapEngine(bus)`. The composed application always calls
   * the latter from `initHeatmapsModule().start`, so in a running process the bus is
   * present; a bus-less engine is what a test or a stray early ingest gets, and
   * publishing is best-effort there rather than a failure.
   */
  constructor(
    private readonly eventBus: EventBus | null = null,
    /**
     * Resolves the website before an auto-capture, so the SSRF guard can check the
     * target against the site's registered domain. Handed straight to the snapshot
     * service, which is the only thing that captures.
     */
    websites: TrackerWebsites | null = null,
    /**
     * Where page backgrounds go. Defaulted rather than required, because the two real
     * callers (`getHeatmapEngine`, `initHeatmapEngine`) have no reason to build one —
     * but a test does, and constructing the default reads `env().s3.bucket`, which means
     * a database URL and a bucket just to exercise a buffer.
     */
    snapshots?: SnapshotIngestService,
  ) {
    this.snapshots = snapshots ?? new SnapshotIngestService(env().s3.bucket, eventBus, websites);
    // One timer for both buffers, so screenshots are never stranded between
    // `processEvents` calls.
    this.pgTimer = setInterval(() => {
      void this.flushPoints();
      void this.flushScreenshots();
    }, pgBatchMs);
  }

  /** Stop the timer, then drain what is left. */
  async shutdown(): Promise<void> {
    clearInterval(this.pgTimer);
    await this.flushPoints();
    await this.flushScreenshots();
  }

  /** Ingest tracker-shaped rows. Each must carry a website UUID. */
  async processEvents(batchId: string, raw: readonly HeatmapTrackerEvent[]): Promise<void> {
    // Projection and type-filtering happen here, not in ingest: the column naming and the
    // set of heatmap event types are both this module's knowledge.
    const events = trackerRowsToHeatmapEvents(raw);
    if (events.length === 0) return;

    this.enqueuePoints(batchId, eventsToPoints(events));

    // Inline rather than buffered: a DOM snapshot is one per page per session, so there
    // is nothing to amortise, and holding HTML in memory to save nothing is a poor trade.
    for (const ev of events) {
      if (ev.type !== "heatmap_dom_snapshot" || !ev.heatmapLayoutEnabled) continue;
      this.snapshots
        .storeDomSnapshot(ev)
        .catch((err) =>
          log.error({ msg: "heatmap_dom_snapshot_failed", url: ev.url, err: String(err) }),
        );
    }

    /*
     * Straight from the event's own `websiteId`.
     *
     * This was a `Promise.all` over a ternary that tested `ev.websiteId`, and on the
     * false branch tested it again before calling a `siteIdFor` lookup — so the lookup
     * was unreachable and the whole resolution round trip never happened. A leftover
     * from when a website had a second `site_id` identifier; there is one id now.
     */
    for (const ev of events) {
      if (ev.type !== "heatmap_screenshot" || !ev.heatmapLayoutEnabled) continue;
      if (!ev.websiteId) continue;
      this.enqueueShots(eventsToScreenshotJobs(ev.websiteId, [ev]));
    }

    // Points and screenshots are drained by the timer — no blocking flush here.
  }

  // ─── Buffers ─────────────────────────────────────────────────────────────

  private enqueuePoints(batchId: string, rows: HeatmapPointRow[]): void {
    let dropped = 0;
    for (const row of rows) {
      if (this.pointBuf.length >= pgQueueCap) {
        dropped++;
        continue;
      }
      this.pointBuf.push({ ...row, batchId });
    }
    if (dropped > 0) {
      log.warn({ msg: "heatmap_point_buffer_full_drop", dropped, cap: pgQueueCap });
    }
  }

  private enqueueShots(jobs: ScreenshotJob[]): void {
    for (const j of jobs) {
      if (this.shotBuf.length >= shotQueueCap) {
        log.warn({ msg: "heatmap_screenshot_buffer_full_drop", cap: shotQueueCap });
        break;
      }
      this.shotBuf.push(j);
    }
  }

  // ─── Flush ───────────────────────────────────────────────────────────────

  private async flushPoints(): Promise<void> {
    if (this.pointBuf.length === 0) return;
    // Drain the full buffer so a single timer tick clears large spikes.
    const drained = this.pointBuf.splice(0);

    // Grouped by originating batch, not sliced by size: the marker guards a whole batch,
    // so a batch must not be split across two guarded writes.
    const byBatch = new Map<string, HeatmapPointRow[]>();
    for (const { batchId, ...row } of drained) {
      const group = byBatch.get(batchId);
      if (group) group.push(row);
      else byBatch.set(batchId, [row]);
    }

    const settled = await Promise.all(
      [...byBatch].map(([batchId, chunk]) =>
        applyBatchOnceSql(batchId, "heatmaps", (tx) => batchUpsertPoints(tx, chunk))
          .then(({ applied }) => (applied ? chunk : null))
          .catch((e: unknown) => {
            log.error({ msg: "heatmap_pg_batch_failed", n: chunk.length, err: String(e) });
            // Null rather than a rethrow: sibling batches stay alive, and the failed rows
            // stay out of the event below.
            return null;
          }),
      ),
    );
    await this.announceCollected(settled);
  }

  private async flushScreenshots(): Promise<void> {
    if (this.shotBuf.length === 0) return;
    const workers = Array.from(
      { length: Math.min(shotConcurrency, this.shotBuf.length) },
      async () => {
        for (let job = this.shotBuf.shift(); job; job = this.shotBuf.shift()) {
          try {
            await this.snapshots.storeScreenshot(job);
          } catch (e) {
            log.error({ msg: "heatmap_screenshot_ingest_failed", url: job.url, err: String(e) });
          }
        }
      },
    );
    await Promise.all(workers);
  }

  /**
   * Announce the points that were actually written, grouped by website.
   *
   * Grouped because a flush interleaves every site sending traffic in the same 400ms
   * window, and a consumer counting a site's activity needs its own number.
   */
  private async announceCollected(settled: (HeatmapPointRow[] | null)[]): Promise<void> {
    if (!this.eventBus) return;

    const byWebsite = new Map<string, number>();
    for (const chunk of settled) {
      if (!chunk) continue;
      for (const row of chunk) {
        byWebsite.set(row.websiteId, (byWebsite.get(row.websiteId) ?? 0) + 1);
      }
    }

    const occurredAt = new Date();
    for (const [websiteId, pointCount] of byWebsite) {
      await this.eventBus.publish("heatmap.data_collected", {
        websiteId,
        pointCount,
        occurredAt,
      });
    }
  }
}

let _engine: HeatmapEngine | null = null;

/**
 * The process-wide engine.
 *
 * Still a singleton because its callers — `services/ingest/queues.ts`,
 * `routes/internal.ts` and the shutdown hook — are module-level and have nothing
 * to inject through. Creates a bus-less engine if nothing initialized one first,
 * so ingest keeps working whether or not events are wired.
 */
export function getHeatmapEngine(): HeatmapEngine {
  if (!_engine) _engine = new HeatmapEngine();
  return _engine;
}

/**
 * Create the engine with an event bus. Called by `initHeatmapsModule().start` before
 * anything can ingest; returns the same instance `getHeatmapEngine()` will hand out.
 *
 * Replaces an already-created engine rather than merging into it, because the only
 * legitimate caller runs at startup — calling it later would strand whatever the
 * previous engine had buffered.
 */
export function initHeatmapEngine(
  eventBus: EventBus,
  websites: TrackerWebsites,
): HeatmapEngine {
  _engine = new HeatmapEngine(eventBus, websites);
  return _engine;
}
