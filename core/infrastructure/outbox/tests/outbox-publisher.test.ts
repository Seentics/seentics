import { describe, it, expect, beforeEach } from "bun:test";
import { InMemoryEventBus, type EventBus, type EventName } from "../../../infrastructure/events";
import {
  OutboxPublisher,
  type OutboxStore,
} from "../../../infrastructure/outbox/outbox-publisher";
import type { PendingOutboxEvent } from "../../../infrastructure/outbox/outbox-repository";
import type { Logger } from "../../../platform/lib/logger";

function makeLogger(): { logger: Logger; errors: Record<string, unknown>[] } {
  const errors: Record<string, unknown>[] = [];
  const logger: Logger = {
    debug() {},
    info() {},
    warn() {},
    error(fields) {
      errors.push(fields);
    },
    child() {
      return logger;
    },
  };
  return { logger, errors };
}

/** In-memory outbox, modelling the parts of the store the publisher relies on. */
class FakeOutboxStore implements OutboxStore {
  rows: (PendingOutboxEvent & { publishedAt: Date | null; lastError?: string })[] = [];
  pruned: Date[] = [];
  /** Set to make `markPublished` throw, simulating a crash after publish. */
  failMarkPublished = false;
  /** Set to make `markFailed` throw, simulating losing the attempt counter. */
  failMarkFailed = false;

  seed(
    eventType: EventName,
    payload: Record<string, unknown>,
    attempts = 0,
  ): string {
    const id = `evt_${this.rows.length + 1}`;
    this.rows.push({ id, eventType, payload, attempts, publishedAt: null });
    return id;
  }

  async claimPending(limit: number, maxAttempts: number): Promise<PendingOutboxEvent[]> {
    return this.rows
      .filter((r) => r.publishedAt === null && r.attempts < maxAttempts)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        eventType: r.eventType,
        payload: r.payload,
        attempts: r.attempts,
      }));
  }

  async markPublished(id: string): Promise<void> {
    if (this.failMarkPublished) throw new Error("db gone");
    const row = this.rows.find((r) => r.id === id);
    if (row) row.publishedAt = new Date();
  }

  async markFailed(id: string, error: string): Promise<void> {
    if (this.failMarkFailed) throw new Error("cannot record failure");
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.attempts += 1;
      row.lastError = error;
    }
  }

  async countPending(maxAttempts: number): Promise<number> {
    return this.rows.filter((r) => r.publishedAt === null && r.attempts < maxAttempts).length;
  }

  async countParked(maxAttempts: number): Promise<number> {
    return this.rows.filter((r) => r.publishedAt === null && r.attempts >= maxAttempts).length;
  }

  async prunePublished(olderThan: Date): Promise<number> {
    this.pruned.push(olderThan);
    return 0;
  }
}

/** Bus that records deliveries and can be made to fail. */
function makeBus(logger: Logger) {
  const delivered: { type: EventName; payload: unknown }[] = [];
  const inner = new InMemoryEventBus(logger);
  let failNext = false;

  const bus: EventBus = {
    async publish(type, payload) {
      if (failNext) throw new Error("bus unavailable");
      delivered.push({ type, payload });
      await inner.publish(type, payload);
    },
    subscribe: inner.subscribe.bind(inner),
  };

  return {
    bus,
    delivered,
    setFailing(v: boolean) {
      failNext = v;
    },
  };
}

const websitePayload = {
  websiteId: "w1",
  siteId: "s1",
  ownerId: "u1",
  url: "example.com",
  occurredAt: "2026-01-01T00:00:00.000Z",
};

describe("OutboxPublisher", () => {
  let store: FakeOutboxStore;
  let logger: Logger;
  let errors: Record<string, unknown>[];
  let bus: ReturnType<typeof makeBus>;
  let publisher: OutboxPublisher;

  beforeEach(() => {
    store = new FakeOutboxStore();
    const l = makeLogger();
    logger = l.logger;
    errors = l.errors;
    bus = makeBus(logger);
    publisher = new OutboxPublisher(bus.bus, store, logger, { batchSize: 10, maxAttempts: 3 });
  });

  describe("drainOnce", () => {
    it("publishes a pending event and marks it published", async () => {
      const id = store.seed("website.created", { ...websitePayload });

      const delivered = await publisher.drainOnce();

      expect(delivered).toBe(1);
      expect(bus.delivered).toHaveLength(1);
      expect(bus.delivered[0]?.type).toBe("website.created");
      expect(store.rows.find((r) => r.id === id)?.publishedAt).not.toBeNull();
    });

    it("returns zero when nothing is pending", async () => {
      expect(await publisher.drainOnce()).toBe(0);
      expect(bus.delivered).toHaveLength(0);
    });

    it("does not republish an already-published row", async () => {
      store.seed("website.created", { ...websitePayload });
      await publisher.drainOnce();
      await publisher.drainOnce();

      expect(bus.delivered).toHaveLength(1);
    });

    it("publishes every row in the batch", async () => {
      store.seed("website.created", { ...websitePayload });
      store.seed("website.deleted", { websiteId: "w2", siteId: "s2", ownerId: "u1", occurredAt: "2026-01-01T00:00:00.000Z" });

      expect(await publisher.drainOnce()).toBe(2);
      expect(bus.delivered.map((d) => d.type)).toEqual(["website.created", "website.deleted"]);
    });

    it("respects the batch size", async () => {
      const small = new OutboxPublisher(bus.bus, store, logger, { batchSize: 2, maxAttempts: 3 });
      for (let i = 0; i < 5; i++) store.seed("website.created", { ...websitePayload });

      expect(await small.drainOnce()).toBe(2);
      expect(bus.delivered).toHaveLength(2);
    });
  });

  // `occurredAt` survives jsonb as a string, but consumers are typed against
  // EventMap which declares it a Date. An outboxed event and a directly-published
  // one must hand handlers the same type for the same field.
  describe("occurredAt revival", () => {
    it("revives an ISO string into a Date", async () => {
      store.seed("website.created", { ...websitePayload });
      await publisher.drainOnce();

      const payload = bus.delivered[0]?.payload as { occurredAt: unknown };
      expect(payload.occurredAt).toBeInstanceOf(Date);
      expect((payload.occurredAt as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("leaves an unparseable value alone rather than producing an Invalid Date", async () => {
      store.seed("website.created", { ...websitePayload, occurredAt: "not-a-date" });
      await publisher.drainOnce();

      const payload = bus.delivered[0]?.payload as { occurredAt: unknown };
      expect(payload.occurredAt).toBe("not-a-date");
    });

    it("leaves a payload without occurredAt untouched", async () => {
      store.seed("analytics.batch_ingested", { siteId: "s1", eventCount: 3 });
      await publisher.drainOnce();

      expect(bus.delivered[0]?.payload).toEqual({ siteId: "s1", eventCount: 3 });
    });
  });

  describe("failure handling", () => {
    it("records an attempt and does not mark published when the bus fails", async () => {
      const id = store.seed("website.created", { ...websitePayload });
      bus.setFailing(true);

      expect(await publisher.drainOnce()).toBe(0);

      const row = store.rows.find((r) => r.id === id)!;
      expect(row.publishedAt).toBeNull();
      expect(row.attempts).toBe(1);
      expect(row.lastError).toBe("bus unavailable");
    });

    it("retries a failed row on the next drain", async () => {
      store.seed("website.created", { ...websitePayload });
      bus.setFailing(true);
      await publisher.drainOnce();

      bus.setFailing(false);
      expect(await publisher.drainOnce()).toBe(1);
      expect(bus.delivered).toHaveLength(1);
    });

    // A single poison payload must not block everything queued behind it.
    it("parks a row once attempts reach maxAttempts", async () => {
      store.seed("website.created", { ...websitePayload });
      bus.setFailing(true);

      await publisher.drainOnce();
      await publisher.drainOnce();
      await publisher.drainOnce();

      // Fourth drain finds nothing: the row is parked, not retried forever.
      bus.setFailing(false);
      expect(await publisher.drainOnce()).toBe(0);
      expect(bus.delivered).toHaveLength(0);

      const stats = await publisher.stats();
      expect(stats.parked).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it("keeps delivering healthy rows while another is parked", async () => {
      store.seed("website.created", { ...websitePayload }, 3); // already parked
      store.seed("website.deleted", { websiteId: "w2", siteId: "s2", ownerId: "u1", occurredAt: "2026-01-01T00:00:00.000Z" });

      expect(await publisher.drainOnce()).toBe(1);
      expect(bus.delivered[0]?.type).toBe("website.deleted");
    });

    it("logs when the attempt counter itself cannot be recorded", async () => {
      store.seed("website.created", { ...websitePayload });
      bus.setFailing(true);
      store.failMarkFailed = true;

      await publisher.drainOnce();

      expect(errors.some((e) => e.msg === "mark_failed_error")).toBe(true);
    });

    // The at-least-once seam: crashing between publish and markPublished replays
    // the event, which is why outbox consumers must be idempotent.
    it("leaves a row claimable when publish succeeds but marking fails", async () => {
      const id = store.seed("website.created", { ...websitePayload });
      store.failMarkPublished = true;

      await publisher.drainOnce();

      expect(bus.delivered).toHaveLength(1);
      expect(store.rows.find((r) => r.id === id)?.publishedAt).toBeNull();

      store.failMarkPublished = false;
      await publisher.drainOnce();
      expect(bus.delivered).toHaveLength(2); // redelivered
    });
  });

  describe("stats", () => {
    it("counts pending rows", async () => {
      store.seed("website.created", { ...websitePayload });
      store.seed("website.created", { ...websitePayload });

      expect((await publisher.stats()).pending).toBe(2);
    });

    it("tracks published and failed counters", async () => {
      store.seed("website.created", { ...websitePayload });
      await publisher.drainOnce();

      store.seed("website.created", { ...websitePayload });
      bus.setFailing(true);
      await publisher.drainOnce();

      const stats = await publisher.stats();
      expect(stats.published).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe("start and stop", () => {
    it("drains in the background once started", async () => {
      store.seed("website.created", { ...websitePayload });
      const p = new OutboxPublisher(
        bus.bus,
        store,
        logger,
        { batchSize: 10, idleIntervalMs: 60, maxAttempts: 3 },
      );

      p.start();
      // One idle interval is enough for the first tick to complete.
      await new Promise((r) => setTimeout(r, 120));
      await p.stop();

      expect(bus.delivered).toHaveLength(1);
    });

    it("stop is safe when never started", async () => {
      await expect(publisher.stop()).resolves.toBeUndefined();
    });

    it("start is idempotent", async () => {
      const p = new OutboxPublisher(bus.bus, store, logger, { idleIntervalMs: 60 });
      p.start();
      p.start();
      await p.stop();
      // Reaching here without a hang is the assertion: two loops would leave one
      // running after a single stop().
      expect(true).toBe(true);
    });

    it("survives a store that throws on claim", async () => {
      // Delegate rather than spread: `store` is a class instance, so its methods
      // live on the prototype and `{...store}` would copy only the fields.
      const throwing: OutboxStore = {
        claimPending: async () => {
          throw new Error("connection refused");
        },
        markPublished: (id) => store.markPublished(id),
        markFailed: (id, err) => store.markFailed(id, err),
        countPending: (max) => store.countPending(max),
        countParked: (max) => store.countParked(max),
        prunePublished: (d) => store.prunePublished(d),
      };
      const p = new OutboxPublisher(bus.bus, throwing, logger, { idleIntervalMs: 60 });

      p.start();
      await new Promise((r) => setTimeout(r, 120));
      await p.stop();

      // Logged and retried rather than crashing the process.
      expect(errors.some((e) => e.msg === "tick_error")).toBe(true);
    });
  });
});
