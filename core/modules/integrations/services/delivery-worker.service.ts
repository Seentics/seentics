import { log } from "../../../platform/observability/logger";
import { claimDue, type ClaimedDelivery } from "../repositories/delivery.repository";

export const POLL_INTERVAL_MS = 5_000;
/** Deliveries taken per round, and attempts allowed to run at once on this process. */
export const BATCH_SIZE = 20;
export const MAX_CONCURRENT_ATTEMPTS = 8;
/** A burst is worked through in rounds; this stops one tick from monopolising the process. */
const MAX_ROUNDS_PER_TICK = 25;

type Attempts = { run(delivery: ClaimedDelivery): Promise<void> };

/**
 * Works the delivery outbox: claims what is due and attempts it.
 *
 * Polls on a timer and on `kick()`, which the capture path calls right after queuing so a lead
 * normally leaves within a moment rather than within a poll. Only one tick runs at a time per
 * process; several processes may run at once because claims are leases (see `claimDue`). Each
 * attempt is isolated: one slow or failing destination neither delays nor fails the others,
 * and nothing here can affect a visitor's form, which has long since been answered.
 */
export class DeliveryWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private current: Promise<void> | null = null;
  private again = false;
  private started = false;
  private stopping = false;

  constructor(
    private readonly attempts: Attempts,
    private readonly claim: (limit: number) => Promise<ClaimedDelivery[]> = claimDue,
    private readonly pollMs: number = POLL_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopping = false;
    this.timer = setInterval(() => this.kick(), this.pollMs);
    this.timer.unref?.();
    this.kick();
  }

  /** Stop polling and wait for the attempts already running. */
  async stop(): Promise<void> {
    this.stopping = true;
    this.started = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.current;
  }

  /** Ask for a tick soon. Safe to call any time; a tick already running is asked to go round again. */
  kick(): void {
    if (!this.started) return;
    if (this.current) {
      this.again = true;
      return;
    }
    this.current = this.tick()
      .catch((err) => log.error({ msg: "integrations_worker_error", err: err instanceof Error ? err.message : "unknown" }))
      .finally(() => {
        this.current = null;
        if (this.again && this.started) {
          this.again = false;
          this.kick();
        }
      });
  }

  /** Exposed for tests: one tick's worth of work. */
  async tick(): Promise<void> {
    for (let round = 0; round < MAX_ROUNDS_PER_TICK && !this.stopping; round++) {
      const due = await this.claim(BATCH_SIZE);
      if (due.length === 0) return;
      await this.runAll(due);
      if (due.length < BATCH_SIZE) return;
    }
  }

  private async runAll(due: readonly ClaimedDelivery[]): Promise<void> {
    let next = 0;
    const lane = async () => {
      while (next < due.length) {
        const delivery = due[next++]!;
        await this.attempts.run(delivery).catch((err) =>
          log.error({ msg: "integrations_attempt_error", deliveryId: delivery.id, err: err instanceof Error ? err.message : "unknown" }),
        );
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_ATTEMPTS, due.length) }, lane));
  }
}
