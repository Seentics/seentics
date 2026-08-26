import { describe, it, expect, beforeEach } from "bun:test";
import type { AppConfig } from "../../../config";
import type { Logger } from "../../../platform/lib/logger";
import type {
  AnalyticsIngestEvent,
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../../../platform/lib/types";
import { InMemoryEventBus, type EventName } from "../../../infrastructure/events";
import type { IngestSinks } from "../interfaces";
import { IngestQueueService } from "../services/ingest-queue.service";

function makeLogger(): { logger: Logger; lines: Record<string, unknown>[] } {
  const lines: Record<string, unknown>[] = [];
  const logger: Logger = {
    debug() {},
    info() {},
    warn(fields) {
      lines.push(fields);
    },
    error(fields) {
      lines.push(fields);
    },
    child() {
      return logger;
    },
  };
  return { logger, lines };
}

/**
 * Recording sinks. `failAnalyticsFor` drives the retry path, which is the behaviour
 * most worth pinning here and which the previous `mock.module`-based tests could not
 * reach.
 */
class FakeSinks implements IngestSinks {
  analyticsCalls: { siteId: string; count: number }[] = [];
  automationCalls: AutomationTriggerQueued[][] = [];
  recordingCalls: TrackerEvent[][] = [];
  heatmapCalls: HeatmapIngestEvent[][] = [];

  failAnalyticsFor = new Set<string>();
  failRecordings = false;
  failHeatmaps = false;
  failAutomations = false;
  /** Rows reported inserted; lower than input models de-duplication. */
  insertedOverride: number | null = null;

  async writeAnalyticsBatch(siteId: string, events: AnalyticsIngestEvent[]): Promise<number> {
    this.analyticsCalls.push({ siteId, count: events.length });
    if (this.failAnalyticsFor.has(siteId)) throw new Error("insert failed");
    return this.insertedOverride ?? events.length;
  }
  async writeAutomationTriggers(rows: AutomationTriggerQueued[]): Promise<void> {
    this.automationCalls.push(rows);
    if (this.failAutomations) throw new Error("automations sink down");
  }
  async processRecordings(events: TrackerEvent[]): Promise<void> {
    this.recordingCalls.push(events);
    if (this.failRecordings) throw new Error("replay engine down");
  }
  async processHeatmaps(events: HeatmapIngestEvent[]): Promise<void> {
    this.heatmapCalls.push(events);
    if (this.failHeatmaps) throw new Error("heatmap engine down");
  }
}

function ev(n = 1): AnalyticsIngestEvent[] {
  return Array.from({ length: n }, (_, i) => ({ eventType: "pageview", i }) as unknown as AnalyticsIngestEvent);
}

/** Config with low thresholds so cap and force-flush behaviour is reachable. */
function cfgWith(overrides: Partial<Record<string, number>> = {}): AppConfig {
  return {
    ingestQueue: {
      flushMs: 10_000, // long, so only explicit flushes run during a test
      maxEventsBeforeForceFlush: 1_000_000,
      maxRecordingsBeforeForceFlush: 1_000_000,
      maxHeatmapsBeforeForceFlush: 1_000_000,
      maxFunnelsBeforeForceFlush: 1_000_000,
      maxAutomationsBeforeForceFlush: 1_000_000,
      ...overrides,
    },
  } as unknown as AppConfig;
}

describe("IngestQueueService", () => {
  let sinks: FakeSinks;
  let lines: Record<string, unknown>[];
  let queue: IngestQueueService;
  let published: { type: EventName; payload: unknown }[];

  beforeEach(() => {
    sinks = new FakeSinks();
    const l = makeLogger();
    lines = l.lines;
    const inner = new InMemoryEventBus(l.logger);
    published = [];
    const bus = {
      publish: async (type: EventName, payload: unknown) => {
        published.push({ type, payload });
        await inner.publish(type, payload as never);
      },
      subscribe: inner.subscribe.bind(inner),
    };
    queue = new IngestQueueService(sinks, bus, l.logger);
    queue.configure(cfgWith());
  });

  describe("analytics events", () => {
    it("no-ops for an empty array", async () => {
      queue.enqueueEvents("site_a", []);
      await queue.flushNow();
      expect(sinks.analyticsCalls).toEqual([]);
    });

    it("writes enqueued events on flush", async () => {
      queue.enqueueEvents("site_a", ev(3));
      await queue.flushNow();
      expect(sinks.analyticsCalls).toEqual([{ siteId: "site_a", count: 3 }]);
    });

    it("accumulates events for one site into a single write", async () => {
      queue.enqueueEvents("site_a", ev(2));
      queue.enqueueEvents("site_a", ev(3));
      await queue.flushNow();
      expect(sinks.analyticsCalls).toEqual([{ siteId: "site_a", count: 5 }]);
    });

    it("writes each site separately", async () => {
      queue.enqueueEvents("site_a", ev(1));
      queue.enqueueEvents("site_b", ev(2));
      await queue.flushNow();

      expect(sinks.analyticsCalls).toHaveLength(2);
      expect(sinks.analyticsCalls.map((c) => c.siteId).sort()).toEqual(["site_a", "site_b"]);
    });

    // The snapshot-swap guard: `clear()`ing the returned reference instead of
    // swapping in a fresh Map dropped every buffered event once already.
    it("empties the buffer so a second flush is a no-op", async () => {
      queue.enqueueEvents("site_a", ev(2));
      await queue.flushNow();
      await queue.flushNow();

      expect(sinks.analyticsCalls).toHaveLength(1);
    });

    it("reports queue depth before and after a flush", async () => {
      queue.enqueueEvents("site_a", ev(4));
      expect(queue.depth().events).toBe(4);

      await queue.flushNow();
      expect(queue.depth().events).toBe(0);
    });
  });

  describe("force flush on threshold", () => {
    it("flushes without an explicit call once the threshold is reached", async () => {
      queue.configure(cfgWith({ maxEventsBeforeForceFlush: 5 }));
      queue.enqueueEvents("site_a", ev(5));

      // The force flush is scheduled, not awaited, so give the chain a turn.
      await queue.flushNow();
      expect(sinks.analyticsCalls[0]?.count).toBe(5);
    });
  });

  describe("hard cap", () => {
    it("drops the overflow beyond 2x the threshold", async () => {
      queue.configure(cfgWith({ maxEventsBeforeForceFlush: 5 })); // cap = 10
      queue.enqueueEvents("site_a", ev(25));
      await queue.flushNow();

      const total = sinks.analyticsCalls.reduce((n, c) => n + c.count, 0);
      expect(total).toBe(10);
    });

    it("logs what it dropped", () => {
      queue.configure(cfgWith({ maxEventsBeforeForceFlush: 5 }));
      queue.enqueueEvents("site_a", ev(25));

      const drop = lines.find((l) => l.msg === "ingest_events_queue_full_drop");
      expect(drop).toMatchObject({ dropped: 15, cap: 10 });
    });

    it("rejects everything once the queue is already at cap", async () => {
      queue.configure(cfgWith({ maxEventsBeforeForceFlush: 2 })); // cap = 4
      queue.enqueueEvents("site_a", ev(4));
      queue.enqueueEvents("site_b", ev(10));
      await queue.flushNow();

      expect(sinks.analyticsCalls.map((c) => c.siteId)).toEqual(["site_a"]);
    });
  });

  /**
   * The retry path. Analytics and funnels are the only retryable branches, because
   * a dropped analytics row corrupts a count while a dropped heatmap point only
   * degrades a picture.
   */
  describe("failed analytics flush", () => {
    it("requeues the batch rather than dropping it", async () => {
      sinks.failAnalyticsFor.add("site_a");
      queue.enqueueEvents("site_a", ev(3));
      await queue.flushNow();

      expect(queue.depth().events).toBe(3);
    });

    it("retries on the next flush and succeeds once the sink recovers", async () => {
      sinks.failAnalyticsFor.add("site_a");
      queue.enqueueEvents("site_a", ev(3));
      await queue.flushNow();

      sinks.failAnalyticsFor.clear();
      await queue.flushNow();

      expect(sinks.analyticsCalls).toHaveLength(2);
      expect(queue.depth().events).toBe(0);
    });

    // Dropping eventually is deliberate: a site whose rows never insert would
    // otherwise hold its snapshot forever and block the queue behind the hard cap.
    it("drops the batch after three failed attempts", async () => {
      sinks.failAnalyticsFor.add("site_a");
      queue.enqueueEvents("site_a", ev(3));

      await queue.flushNow();
      await queue.flushNow();
      await queue.flushNow();

      expect(queue.depth().events).toBe(0);
      const dropped = lines.find((l) => l.dropped === 3);
      expect(dropped).toMatchObject({ msg: "ingest_analytics_batch_failed", attempts: 3 });
    });

    it("keeps a healthy site flushing while another fails", async () => {
      sinks.failAnalyticsFor.add("site_bad");
      queue.enqueueEvents("site_bad", ev(2));
      queue.enqueueEvents("site_good", ev(2));
      await queue.flushNow();

      expect(sinks.analyticsCalls).toHaveLength(2);
      // Only the failing site is still buffered.
      expect(queue.depth().events).toBe(2);
    });

    it("preserves ordering by prepending the retried batch", async () => {
      sinks.failAnalyticsFor.add("site_a");
      queue.enqueueEvents("site_a", ev(2));
      await queue.flushNow();

      queue.enqueueEvents("site_a", ev(1));
      sinks.failAnalyticsFor.clear();
      await queue.flushNow();

      // Retried rows plus the newly enqueued one, in one write.
      expect(sinks.analyticsCalls[1]).toEqual({ siteId: "site_a", count: 3 });
    });
  });

  describe("funnels", () => {
    it("no-ops for an empty array", async () => {
      queue.enqueueFunnels("site_a", []);
      await queue.flushNow();
      expect(sinks.analyticsCalls).toEqual([]);
    });

    it("writes funnel events through the analytics sink", async () => {
      queue.enqueueFunnels("site_a", ev(2));
      await queue.flushNow();
      expect(sinks.analyticsCalls).toEqual([{ siteId: "site_a", count: 2 }]);
    });

    it("writes each site separately", async () => {
      queue.enqueueFunnels("site_a", ev(1));
      queue.enqueueFunnels("site_b", ev(1));
      await queue.flushNow();
      expect(sinks.analyticsCalls).toHaveLength(2);
    });

    // Funnels and events share a sink but not a buffer or a retry counter.
    it("is buffered separately from events", async () => {
      queue.enqueueEvents("site_a", ev(2));
      queue.enqueueFunnels("site_a", ev(3));

      expect(queue.depth()).toMatchObject({ events: 2, funnels: 3 });
    });
  });

  describe("recordings", () => {
    it("no-ops for an empty array", async () => {
      queue.enqueueRecordings([]);
      await queue.flushNow();
      expect(sinks.recordingCalls).toEqual([]);
    });

    it("passes recordings to the engine", async () => {
      queue.enqueueRecordings([{ type: "rrweb" } as unknown as TrackerEvent]);
      await queue.flushNow();
      expect(sinks.recordingCalls).toHaveLength(1);
    });

    it("empties the buffer after flush", async () => {
      queue.enqueueRecordings([{ type: "rrweb" } as unknown as TrackerEvent]);
      await queue.flushNow();
      expect(queue.depth().recordings).toBe(0);
    });

    // Not requeued: no retry counter, so re-adding on every failure would grow the
    // buffer without bound while the engine stays down.
    it("does not requeue after an engine failure", async () => {
      sinks.failRecordings = true;
      queue.enqueueRecordings([{ type: "rrweb" } as unknown as TrackerEvent]);
      await queue.flushNow();

      expect(queue.depth().recordings).toBe(0);
      expect(lines.some((l) => l.msg === "ingest_recordings_failed")).toBe(true);
    });
  });

  describe("heatmaps", () => {
    it("no-ops for an empty array", async () => {
      queue.enqueueHeatmaps([]);
      await queue.flushNow();
      expect(sinks.heatmapCalls).toEqual([]);
    });

    it("passes heatmaps to the engine", async () => {
      queue.enqueueHeatmaps([{ type: "click" } as unknown as HeatmapIngestEvent]);
      await queue.flushNow();
      expect(sinks.heatmapCalls).toHaveLength(1);
    });

    it("empties the buffer after flush", async () => {
      queue.enqueueHeatmaps([{ type: "click" } as unknown as HeatmapIngestEvent]);
      await queue.flushNow();
      expect(queue.depth().heatmaps).toBe(0);
    });
  });

  describe("automations", () => {
    it("no-ops for an empty array", async () => {
      queue.enqueueAutomations([]);
      await queue.flushNow();
      expect(sinks.automationCalls).toEqual([]);
    });

    it("writes queued triggers", async () => {
      queue.enqueueAutomations([{ automationId: "a" } as unknown as AutomationTriggerQueued]);
      await queue.flushNow();
      expect(sinks.automationCalls).toHaveLength(1);
    });

    it("empties the buffer after flush", async () => {
      queue.enqueueAutomations([{ automationId: "a" } as unknown as AutomationTriggerQueued]);
      await queue.flushNow();
      expect(queue.depth().automations).toBe(0);
    });
  });

  describe("flush isolation", () => {
    it("drains every category in one call", async () => {
      queue.enqueueEvents("site_a", ev(1));
      queue.enqueueFunnels("site_a", ev(1));
      queue.enqueueRecordings([{ type: "rrweb" } as unknown as TrackerEvent]);
      queue.enqueueHeatmaps([{ type: "click" } as unknown as HeatmapIngestEvent]);
      queue.enqueueAutomations([{ automationId: "a" } as unknown as AutomationTriggerQueued]);

      await queue.flushNow();

      expect(sinks.analyticsCalls).toHaveLength(2);
      expect(sinks.recordingCalls).toHaveLength(1);
      expect(sinks.heatmapCalls).toHaveLength(1);
      expect(sinks.automationCalls).toHaveLength(1);
    });

    // One sink being down must not stop the other four.
    it("flushes the healthy branches when one sink throws", async () => {
      sinks.failRecordings = true;
      sinks.failHeatmaps = true;

      queue.enqueueEvents("site_a", ev(1));
      queue.enqueueRecordings([{ type: "rrweb" } as unknown as TrackerEvent]);
      queue.enqueueHeatmaps([{ type: "click" } as unknown as HeatmapIngestEvent]);
      queue.enqueueAutomations([{ automationId: "a" } as unknown as AutomationTriggerQueued]);

      await queue.flushNow();

      expect(sinks.analyticsCalls).toHaveLength(1);
      expect(sinks.automationCalls).toHaveLength(1);
    });

    it("never rejects from flushNow even when every sink fails", async () => {
      sinks.failAnalyticsFor.add("site_a");
      sinks.failRecordings = true;
      sinks.failHeatmaps = true;
      sinks.failAutomations = true;

      queue.enqueueEvents("site_a", ev(1));
      queue.enqueueRecordings([{ type: "rrweb" } as unknown as TrackerEvent]);
      queue.enqueueHeatmaps([{ type: "click" } as unknown as HeatmapIngestEvent]);
      queue.enqueueAutomations([{ automationId: "a" } as unknown as AutomationTriggerQueued]);

      await expect(queue.flushNow()).resolves.toBeUndefined();
    });
  });

  describe("lifecycle", () => {
    it("start is idempotent", () => {
      queue.start();
      queue.start();
      queue.stop();
      // Reaching here without a lingering interval is the assertion; a second
      // timer would keep the process alive past stop().
      expect(queue.depth().events).toBe(0);
    });

    it("stop is safe when never started", () => {
      expect(() => queue.stop()).not.toThrow();
    });

    it("flushes on the timer once started", async () => {
      queue.configure(cfgWith({ flushMs: 20 } as never));
      queue.enqueueEvents("site_a", ev(1));
      queue.start();

      await new Promise((r) => setTimeout(r, 60));
      queue.stop();

      expect(sinks.analyticsCalls).toHaveLength(1);
    });

    it("does not flush after stop", async () => {
      queue.configure(cfgWith({ flushMs: 20 } as never));
      queue.start();
      queue.stop();
      queue.enqueueEvents("site_a", ev(1));

      await new Promise((r) => setTimeout(r, 60));
      expect(sinks.analyticsCalls).toHaveLength(0);
    });
  });

  /**
   * `analytics.batch_ingested` already had a subscriber — automation evaluation —
   * but nothing published it, so that wiring was dead. These pin the contract.
   */
  describe("analytics.batch_ingested", () => {
    it("announces a successful flush", async () => {
      queue.enqueueEvents("site_a", ev(3));
      await queue.flushNow();

      const e = published.find((p) => p.type === "analytics.batch_ingested");
      expect(e?.payload).toMatchObject({ siteId: "site_a", eventCount: 3 });
    });

    it("reports the inserted count, not the submitted count", async () => {
      sinks.insertedOverride = 2;
      queue.enqueueEvents("site_a", ev(5));
      await queue.flushNow();

      const e = published.find((p) => p.type === "analytics.batch_ingested");
      expect(e?.payload).toMatchObject({ eventCount: 2 });
    });

    // Announcing on enqueue would have consumers reacting to rows a later failure
    // drops. Nothing is announced until the write succeeded.
    it("announces nothing when the write failed", async () => {
      sinks.failAnalyticsFor.add("site_a");
      queue.enqueueEvents("site_a", ev(3));
      await queue.flushNow();

      expect(published.filter((p) => p.type === "analytics.batch_ingested")).toEqual([]);
    });

    it("announces once per site", async () => {
      queue.enqueueEvents("site_a", ev(1));
      queue.enqueueEvents("site_b", ev(1));
      await queue.flushNow();

      const sites = published
        .filter((p) => p.type === "analytics.batch_ingested")
        .map((p) => (p.payload as { siteId: string }).siteId)
        .sort();
      expect(sites).toEqual(["site_a", "site_b"]);
    });

    it("announces nothing when there was nothing to flush", async () => {
      await queue.flushNow();
      expect(published).toEqual([]);
    });
  });

  describe("insert count reporting", () => {
    it("tolerates a sink reporting fewer rows inserted than submitted", async () => {
      sinks.insertedOverride = 1;
      queue.enqueueEvents("site_a", ev(5));
      await queue.flushNow();

      // De-duplication is the sink's business; the queue must still consider the
      // batch delivered and not retry it.
      expect(queue.depth().events).toBe(0);
    });

    it("treats zero inserted as success, not failure", async () => {
      sinks.insertedOverride = 0;
      queue.enqueueEvents("site_a", ev(3));
      await queue.flushNow();

      expect(queue.depth().events).toBe(0);
    });
  });
});
