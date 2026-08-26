import type { EventBus } from "../../../infrastructure/events";
import type { Logger } from "../../../platform/lib/logger";
import type { AutomationTriggerQueued, TrackerEvent } from "../../../platform/lib/types";
import type { HeatmapTrackerEvent } from "../../heatmaps/interfaces";
import type { BatchQueueStore, IngestCategory, IngestSinks, QueuedBatch } from "../interfaces";

/** Every category the worker drains. Order is only the order it polls them. */
const CATEGORIES: readonly IngestCategory[] = [
  "analytics",
  "funnels",
  "automations",
  "recordings",
  "heatmaps",
];

export type IngestWorkerOptions = {
  /** Batches claimed per category per tick. */
  batchSize?: number;
  /** Delay between ticks when the last one found nothing. */
  idleIntervalMs?: number;
  /** Attempts before a batch is parked for inspection rather than retried forever. */
  maxAttempts?: number;
  /** How long applied batches are kept before pruning. */
  retainCompletedMs?: number;
};

const DEFAULTS: Required<IngestWorkerOptions> = {
  batchSize: 20,
  idleIntervalMs: 250,
  maxAttempts: 5,
  retainCompletedMs: 6 * 60 * 60 * 1000,
};

/**
 * Drains the durable queue into the module sinks.
 *
 * The counterpart to `IngestQueueService`: that side batches and enqueues, this side
 * claims and applies. Splitting them is what makes the pipeline survive a restart — the
 * batch is a committed row before any write is attempted, so a crash costs at most the
 * batches currently in flight instead of every in-memory buffer.
 *
 * Each category is polled independently, and that isolation is the point. Heatmaps is the
 * slowest consumer by a wide margin — aggregating upserts plus Playwright captures — and
 * in the single-flush design its slowness delayed analytics writes for every site. Here a
 * stalled heatmap category drains at its own pace while analytics keeps up.
 *
 * A failed batch is retried, then **parked**, never dropped. The in-memory flush drops a
 * batch after three attempts with a log line, which is defensible when the whole window is
 * milliseconds and indefensible once the batch is a durable row you could have replayed.
 */
export class IngestWorker {
  private readonly log: Logger;
  private readonly opts: Required<IngestWorkerOptions>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private draining = false;
  private stopped = false;

  private appliedCount = 0;
  private failedCount = 0;
  private lastPruneAt = 0;

  constructor(
    private readonly store: BatchQueueStore,
    private readonly sinks: IngestSinks,
    /**
     * Announces `analytics.batch_ingested` once rows are actually in the table.
     *
     * Published here rather than on enqueue: the event means the data is queryable, and a
     * batch that ends up parked never wrote anything. Automation evaluation subscribes to
     * it to know a site has fresh data.
     */
    private readonly eventBus: EventBus,
    logger: Logger,
    options: IngestWorkerOptions = {},
  ) {
    this.log = logger.child({ category: "ingest_worker" });
    this.opts = { ...DEFAULTS, ...options };
  }

  /** Begin polling. Idempotent. */
  start(): void {
    if (this.timer) return;
    this.stopped = false;
    this.schedule(0);
  }

  /**
   * Stop polling and wait for the current tick to finish.
   *
   * Awaiting matters: a batch is claimed under a row lock, and abandoning the tick
   * mid-apply would leave it locked until the connection drops.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    while (this.draining) await new Promise((r) => setTimeout(r, 10));
  }

  /** Drain every category once. Exposed so a test or a shutdown can force a pass. */
  async drainOnce(): Promise<number> {
    if (this.draining) return 0;
    this.draining = true;
    try {
      let applied = 0;
      // Sequentially, not in parallel: the sinks share a connection pool, and five
      // concurrent category drains would starve the request path that shares it.
      for (const category of CATEGORIES) {
        applied += await this.drainCategory(category);
      }
      await this.pruneIfDue();
      return applied;
    } finally {
      this.draining = false;
    }
  }

  /** Counters for a health endpoint. */
  stats(): { applied: number; failed: number } {
    return { applied: this.appliedCount, failed: this.failedCount };
  }

  private async drainCategory(category: IngestCategory): Promise<number> {
    let claimed: QueuedBatch[];
    try {
      claimed = await this.store.claimPending(category, this.opts.batchSize, this.opts.maxAttempts);
    } catch (err) {
      // A claim failure is the database being unreachable, not a bad batch. Log and let
      // the next tick try — there is nothing to park.
      this.log.error({ msg: "ingest_claim_failed", category, err: errText(err) });
      return 0;
    }

    let applied = 0;
    for (const batch of claimed) {
      if (this.stopped) break;
      if (await this.applyOne(batch)) applied += 1;
    }
    return applied;
  }

  private async applyOne(batch: QueuedBatch): Promise<boolean> {
    try {
      await this.dispatch(batch);
      await this.store.markCompleted(batch.batchId);
      this.appliedCount += 1;
      this.log.debug({
        msg: "ingest_batch_applied",
        category: batch.category,
        rows: batch.rowCount,
      });
      return true;
    } catch (err) {
      this.failedCount += 1;
      const attempts = batch.attempts + 1;
      await this.store.markFailed(batch.batchId, errText(err)).catch((markErr) => {
        // If even recording the failure fails, the batch stays pending with its old
        // count and is retried. Worth a distinct log line: it means the database is in
        // worse shape than a single bad write.
        this.log.error({ msg: "ingest_mark_failed_failed", err: errText(markErr) });
      });

      const parked = attempts >= this.opts.maxAttempts;
      this.log[parked ? "error" : "warn"]({
        msg: parked ? "ingest_batch_parked" : "ingest_batch_retrying",
        category: batch.category,
        batch_id: batch.batchId,
        attempts,
        rows: batch.rowCount,
        err: errText(err),
      });
      return false;
    }
  }

  /**
   * Hand a batch to the module that owns its data.
   *
   * The payload shapes are the sinks' own input types, cast back from JSON. That coupling
   * is why the batch id is content-derived: a change to one of these shapes changes the
   * hash, so an old queued batch and a new one can never be confused for each other.
   */
  private async dispatch(batch: QueuedBatch): Promise<void> {
    const { batchId, payload } = batch;

    switch (batch.category) {
      case "analytics":
      case "funnels": {
        const websiteId = payload.websiteId as string;
        const events = payload.events as TrackerEvent[];
        const inserted = await this.sinks.writeAnalyticsBatch(batchId, websiteId, events);

        // Zero means the batch had already been applied — a normal redelivery, and not
        // something to announce a second time.
        if (inserted > 0) {
          await this.eventBus.publish("analytics.batch_ingested", {
            websiteId,
            eventCount: inserted,
            occurredAt: new Date(),
          });
        }
        return;
      }
      case "automations":
        await this.sinks.writeAutomationTriggers(batchId, payload.rows as AutomationTriggerQueued[]);
        return;
      case "recordings":
        await this.sinks.processRecordings(batchId, payload.events as TrackerEvent[]);
        return;
      case "heatmaps":
        await this.sinks.processHeatmaps(batchId, payload.events as HeatmapTrackerEvent[]);
        return;
    }
  }

  /** Prune applied rows on the same cadence as the outbox does, not every tick. */
  private async pruneIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPruneAt < this.opts.retainCompletedMs) return;
    this.lastPruneAt = now;
    try {
      const pruned = await this.store.pruneCompleted(new Date(now - this.opts.retainCompletedMs));
      if (pruned > 0) this.log.info({ msg: "ingest_batches_pruned", n: pruned });
    } catch (err) {
      this.log.warn({ msg: "ingest_prune_failed", err: errText(err) });
    }
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    const applied = await this.drainOnce();
    if (this.stopped) return;
    // No delay while there is work: a backlog drains as fast as the sinks allow.
    this.schedule(applied > 0 ? 0 : this.opts.idleIntervalMs);
  }
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
