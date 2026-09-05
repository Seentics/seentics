import { describe, it, expect, beforeEach } from "bun:test";
import type { AppConfig } from "../../../config";
import type { Logger } from "../../../platform/lib/logger";
import type {
  AnalyticsIngestEvent,
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../../../platform/lib/types";
import type { VisitorProfileWrite } from "../../automations/interfaces";
import type { BatchQueueStore, IngestCategory } from "../interfaces";
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
 * Recording queue store.
 *
 * The service enqueues durable batches now rather than calling the sinks, so this fake
 * stands in for `BatchQueueStore`. It decodes each batch by category into the same
 * accessors the assertions below already used — what those tests care about is which rows
 * reach which category, and that is unchanged by moving the hand-off to a queue row.
 *
 * `failAnalyticsFor` drives the retry path, which is the behaviour most worth pinning here
 * and which the earlier `mock.module`-based tests could not reach.
 */
class FakeBatchQueue implements BatchQueueStore {
  analyticsCalls: { websiteId: string; count: number }[] = [];
  automationCalls: AutomationTriggerQueued[][] = [];
  recordingCalls: TrackerEvent[][] = [];
  heatmapCalls: HeatmapIngestEvent[][] = [];
  profileCalls: VisitorProfileWrite[][] = [];

  /** Every batch id seen, so a test can assert the same rows reuse one id. */
  batchIds: string[] = [];
  /** Partition keys, so the recordings-per-session split is assertable. */
  partitionKeys: string[] = [];

  failAnalyticsFor = new Set<string>();
  failRecordings = false;
  failHeatmaps = false;
  failAutomations = false;
  /** Unused now the worker reports insert counts; kept so callers need not change. */
  insertedOverride: number | null = null;

  async enqueue(batch: {
    batchId: string;
    category: IngestCategory;
    partitionKey: string;
    payload: Record<string, unknown>;
    rowCount: number;
  }): Promise<void> {
    this.batchIds.push(batch.batchId);
    this.partitionKeys.push(batch.partitionKey);

    switch (batch.category) {
      case "analytics":
      case "funnels": {
        const websiteId = batch.payload.websiteId as string;
        // Recorded before the throw: these tests count *attempts*, and the retry path is
        // the behaviour they exist to pin.
        this.analyticsCalls.push({ websiteId, count: batch.rowCount });
        if (this.failAnalyticsFor.has(websiteId)) throw new Error("insert failed");
        return;
      }
      case "automations":
        this.automationCalls.push(batch.payload.rows as AutomationTriggerQueued[]);
        if (this.failAutomations) throw new Error("automations sink down");
        return;
      case "recordings":
        this.recordingCalls.push(batch.payload.events as TrackerEvent[]);
        if (this.failRecordings) throw new Error("replay engine down");
        return;
      case "heatmaps":
        this.heatmapCalls.push(batch.payload.events as HeatmapIngestEvent[]);
        if (this.failHeatmaps) throw new Error("heatmap engine down");
        return;
      case "profiles":
        this.profileCalls.push(batch.payload.rows as VisitorProfileWrite[]);
        return;
    }
  }

  // The service only enqueues; draining is the worker's job and is tested separately.
  async claimPending(): Promise<never[]> {
    return [];
  }
  async markCompleted(): Promise<void> {}
  async markFailed(): Promise<void> {}

  async releaseClaims(): Promise<void> {}
  async countPending(): Promise<number> {
    return 0;
  }
  async countParked(): Promise<number> {
    return 0;
  }
  async pruneCompleted(): Promise<number> {
    return 0;
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
      maxProfilesBeforeForceFlush: 1_000_000,
      maxHeatmapBytes: 64 * 1024 * 1024,
      ...overrides,
    },
  } as unknown as AppConfig;
}

describe("IngestQueueService", () => {
  let sinks: FakeBatchQueue;
  let lines: Record<string, unknown>[];
  let queue: IngestQueueService;

  beforeEach(() => {
    sinks = new FakeBatchQueue();
    const l = makeLogger();
    lines = l.lines;
    queue = new IngestQueueService(sinks, l.logger);
    queue.configure(cfgWith());
  });

  /**
   * The profile write used to bypass all of this — one un-awaited upsert per `/collect`,
   * on the only path in the system that is otherwise careful never to touch Postgres per
   * request. It takes the same route as everything else now.
   */
  describe("visitor profiles", () => {
    function profile(
      websiteId: string,
      anonymousId: string,
      overrides: Partial<VisitorProfileWrite> = {},
    ): VisitorProfileWrite {
      return { websiteId, anonymousId, pageViews: 1, ...overrides };
    }

    it("no-ops for an empty array", async () => {
      queue.enqueueProfiles([]);
      await queue.flushNow();
      expect(sinks.profileCalls).toEqual([]);
    });

    it("buffers rather than writing on enqueue", () => {
      queue.enqueueProfiles([profile("site_a", "v1")]);
      expect(sinks.profileCalls).toEqual([]);
      expect(queue.depth().profiles).toBe(1);
    });

    it("queues one batch per website", async () => {
      queue.enqueueProfiles([profile("site_a", "v1"), profile("site_b", "v2")]);
      await queue.flushNow();

      expect(sinks.profileCalls).toHaveLength(2);
      expect(sinks.partitionKeys.sort()).toEqual(["site_a", "site_b"]);
    });

    it("keeps one website's visitors in a single batch", async () => {
      queue.enqueueProfiles([profile("site_a", "v1"), profile("site_a", "v2")]);
      await queue.flushNow();

      expect(sinks.profileCalls).toHaveLength(1);
      expect(sinks.profileCalls[0]).toHaveLength(2);
    });

    it("clears the buffer once flushed", async () => {
      queue.enqueueProfiles([profile("site_a", "v1")]);
      await queue.flushNow();
      expect(queue.depth().profiles).toBe(0);

      await queue.flushNow();
      expect(sinks.profileCalls).toHaveLength(1);
    });
  });

  /**
   * These buffers are flat and accumulate every site sending traffic in the same window,
   * so a single batch keyed on `rows[0].websiteId` named an arbitrary site — and because
   * at most one batch per partition key is in flight, every other site's data then queued
   * behind that arbitrary key.
   */
  describe("partitioning flat buffers", () => {
    it("splits heatmaps by website", async () => {
      queue.enqueueHeatmaps([
        { websiteId: "site_a", type: "heatmap_click", ts: 1, url: "/a", data: {} },
        { websiteId: "site_b", type: "heatmap_click", ts: 2, url: "/b", data: {} },
      ] as unknown as HeatmapIngestEvent[]);
      await queue.flushNow();

      expect(sinks.heatmapCalls).toHaveLength(2);
      expect(sinks.partitionKeys.sort()).toEqual(["site_a", "site_b"]);
    });

    it("splits automation triggers by website", async () => {
      queue.enqueueAutomations([
        { websiteId: "site_a", automationId: "a1", occurredAt: new Date(0), detail: {} },
        { websiteId: "site_b", automationId: "a2", occurredAt: new Date(0), detail: {} },
      ] as unknown as AutomationTriggerQueued[]);
      await queue.flushNow();

      expect(sinks.automationCalls).toHaveLength(2);
      expect(sinks.partitionKeys.sort()).toEqual(["site_a", "site_b"]);
    });
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
      expect(sinks.analyticsCalls).toEqual([{ websiteId: "site_a", count: 3 }]);
    });

    it("accumulates events for one site into a single write", async () => {
      queue.enqueueEvents("site_a", ev(2));
      queue.enqueueEvents("site_a", ev(3));
      await queue.flushNow();
      expect(sinks.analyticsCalls).toEqual([{ websiteId: "site_a", count: 5 }]);
    });

    it("writes each site separately", async () => {
      queue.enqueueEvents("site_a", ev(1));
      queue.enqueueEvents("site_b", ev(2));
      await queue.flushNow();

      expect(sinks.analyticsCalls).toHaveLength(2);
      expect(sinks.analyticsCalls.map((c) => c.websiteId).sort()).toEqual(["site_a", "site_b"]);
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

      expect(sinks.analyticsCalls.map((c) => c.websiteId)).toEqual(["site_a"]);
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
      expect(sinks.analyticsCalls[1]).toEqual({ websiteId: "site_a", count: 3 });
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
      expect(sinks.analyticsCalls).toEqual([{ websiteId: "site_a", count: 2 }]);
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
  /**
   * `analytics.batch_ingested` moved to `IngestWorker`.
   *
   * The event means rows are queryable, and this side only knows a batch was queued — a
   * batch that later parks never wrote anything. Its assertions live in
   * `ingest-worker.service.test.ts`; what remains here is that the queue itself announces
   * nothing.
   */
  describe("announcements", () => {
    it("queues one batch per site and writes nothing itself", async () => {
      queue.enqueueEvents("site_a", ev(3));
      queue.enqueueEvents("site_b", ev(1));
      await queue.flushNow();

      // The queue's whole job is to hand batches to `ingest_batches`; applying them is
      // the worker's, and this side must not reach a sink directly.
      expect(sinks.analyticsCalls.map((c) => c.websiteId).sort()).toEqual(["site_a", "site_b"]);
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
