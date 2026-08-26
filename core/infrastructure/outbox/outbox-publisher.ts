import type { Logger } from "../../platform/lib/logger";
import type { EventBus, EventMap, EventName } from "../events";
// Type-only: importing the repository at runtime would pull in the database
// connection, and this file must stay loadable without one.
import type { PendingOutboxEvent } from "./outbox-repository";

/**
 * The store operations the publisher needs.
 *
 * An interface rather than direct imports of the query functions, so the
 * publisher's retry, parking and pruning logic — the part actually worth testing —
 * can be exercised without a database. `postgresOutboxStore` in
 * `postgres-outbox-store.ts` is the production implementation, deliberately kept
 * in a separate file so importing the publisher does not require a live
 * connection.
 */
export interface OutboxStore {
  claimPending(limit: number, maxAttempts: number): Promise<PendingOutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  countPending(maxAttempts: number): Promise<number>;
  countParked(maxAttempts: number): Promise<number>;
  prunePublished(olderThan: Date): Promise<number>;
}

export type OutboxPublisherOptions = {
  /** Rows claimed per tick. */
  batchSize?: number;
  /** Delay between ticks when the last tick found nothing. */
  idleIntervalMs?: number;
  /** Retries before a row is parked as failed and skipped. */
  maxAttempts?: number;
  /** How long delivered rows are kept before pruning. */
  retainPublishedMs?: number;
};

const DEFAULTS = {
  batchSize: 100,
  idleIntervalMs: 1_000,
  maxAttempts: 10,
  retainPublishedMs: 24 * 60 * 60 * 1000,
} as const;

/**
 * `occurredAt` round-trips through jsonb as an ISO string. Consumers are typed
 * against `EventMap`, which declares it as a `Date`, so restore it before
 * dispatch — otherwise an outboxed event and a directly-published one would
 * hand handlers different types for the same field.
 */
function reviveOccurredAt(payload: Record<string, unknown>): Record<string, unknown> {
  const raw = payload.occurredAt;
  if (typeof raw !== "string") return payload;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return payload;
  return { ...payload, occurredAt: parsed };
}

/**
 * Drains the transactional outbox onto the event bus.
 *
 * Runs as a background loop for the lifetime of the process. Because a crash
 * between `publish` and `markPublished` replays the row, delivery is
 * **at-least-once** — consumers of outboxed events must be idempotent.
 *
 * A row that keeps failing is retried up to `maxAttempts`, then parked so one
 * poison payload cannot stall everything behind it. Parked rows are counted by
 * `countFailed` and require an operator to resolve.
 */
export class OutboxPublisher {
  private readonly log: Logger;
  private readonly opts: Required<OutboxPublisherOptions>;

  private running = false;
  /** Resolves once the loop has actually exited, so `stop()` can await it. */
  private loop: Promise<void> | null = null;
  /** Wakes the idle sleep early so shutdown is not delayed by a full interval. */
  private wake: (() => void) | null = null;

  private publishedCount = 0;
  private failedCount = 0;
  private lastPrunedAt = 0;

  constructor(
    private readonly bus: EventBus,
    private readonly store: OutboxStore,
    logger: Logger,
    options: OutboxPublisherOptions = {},
  ) {
    this.log = logger.child({ category: "outbox" });
    this.opts = { ...DEFAULTS, ...options };
  }

  /** Begin draining. Returns immediately; the loop runs in the background. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = this.run();
    this.log.info({ msg: "publisher_started", batchSize: this.opts.batchSize });
  }

  /**
   * Stop draining and wait for the in-flight tick to finish, so shutdown does
   * not abandon a batch midway.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.wake?.();
    await this.loop?.catch(() => {});
    this.loop = null;
    this.log.info({
      msg: "publisher_stopped",
      published: this.publishedCount,
      failed: this.failedCount,
    });
  }

  /** Counters plus live backlog. `failed` rows will not retry without help. */
  async stats(): Promise<{
    published: number;
    failed: number;
    pending: number;
    parked: number;
  }> {
    return {
      published: this.publishedCount,
      failed: this.failedCount,
      pending: await this.store.countPending(this.opts.maxAttempts),
      parked: await this.store.countParked(this.opts.maxAttempts),
    };
  }

  /**
   * Publish one batch. Exposed so tests and `POST /internal/*` can drain
   * deterministically instead of waiting on the loop. Returns rows delivered.
   */
  async drainOnce(): Promise<number> {
    const batch = await this.store.claimPending(this.opts.batchSize, this.opts.maxAttempts);
    if (batch.length === 0) return 0;

    let delivered = 0;
    for (const event of batch) {
      if (await this.deliver(event)) delivered += 1;
    }
    return delivered;
  }

  private async deliver(event: PendingOutboxEvent): Promise<boolean> {
    try {
      // The bus swallows handler errors, so a throw here means the payload or
      // the bus itself is broken — genuinely worth a retry.
      await this.bus.publish(
        event.eventType,
        reviveOccurredAt(event.payload) as EventMap[EventName],
      );
      await this.store.markPublished(event.id);
      this.publishedCount += 1;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.failedCount += 1;
      await this.store.markFailed(event.id, message).catch((markErr) => {
        // If we cannot even record the failure the row stays claimable and will
        // be retried; log loudly because attempts are not advancing.
        this.log.error({
          msg: "mark_failed_error",
          outboxId: event.id,
          err: markErr instanceof Error ? markErr.message : String(markErr),
        });
      });

      const attempts = event.attempts + 1;
      this.log.error({
        msg: "publish_failed",
        outboxId: event.id,
        event: event.eventType,
        attempts,
        parked: attempts >= this.opts.maxAttempts,
        err: message,
      });
      return false;
    }
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        const delivered = await this.drainOnce();
        await this.maybePrune();
        // A full batch implies more is waiting — keep going without sleeping.
        if (delivered >= this.opts.batchSize) continue;
      } catch (err) {
        // Typically the database being unreachable. Sleep and retry rather than
        // dying, so the publisher recovers on its own once the DB returns.
        this.log.error({
          msg: "tick_error",
          err: err instanceof Error ? err.message : String(err),
        });
      }
      await this.sleep(this.opts.idleIntervalMs);
    }
  }

  /** Prune delivered rows about once per retention window. */
  private async maybePrune(): Promise<void> {
    const interval = this.opts.retainPublishedMs;
    const now = Date.now();
    if (now - this.lastPrunedAt < interval) return;
    this.lastPrunedAt = now;

    try {
      const removed = await this.store.prunePublished(new Date(now - interval));
      if (removed > 0) this.log.info({ msg: "pruned", rows: removed });
    } catch (err) {
      this.log.warn({
        msg: "prune_error",
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Interruptible sleep so `stop()` does not wait out the full interval. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wake = null;
        resolve();
      }, ms);
      this.wake = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
    });
  }
}
