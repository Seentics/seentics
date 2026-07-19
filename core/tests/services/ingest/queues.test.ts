import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";
import type { AppConfig } from "../../../config";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// Do NOT mock analytics-batch here — it has its own test file.
// Mock the DB instead so the real analytics-batch code runs under test.

const mockDbValues = mock(async () => {});
const mockDbInsert = mock(() => ({ values: mockDbValues }));
const mockDbTxInsert = mock(() => ({ values: mockDbValues }));

mock.module("../../../db", () => ({
  analyticsEvents: {},
  automations: {},
  automationEvents: {},
  db: {
    insert: mockDbInsert,
    transaction: mock(async (fn: any) => fn({ insert: mockDbTxInsert })),
    // automation-batch uses db.select().from().where() to check active automations
    select: mock(() => ({ from: mock(() => ({ where: mock(async () => []) })) })),
  },
  sql: mock(async () => []),
}));

// Mock automation-batch: no separate test file exists, safe to mock entirely.
const mockIngestAutomationTriggersBatch = mock(async () => {});
mock.module("../../../services/ingest/automation-batch", () => ({
  ingestAutomationTriggersBatch: mockIngestAutomationTriggersBatch,
}));

const mockProcessReplayEvents = mock(async () => {});
mock.module("../../../lib/replay-engine", () => ({
  getReplayEngine: () => ({ processEvents: mockProcessReplayEvents }),
}));

const mockProcessHeatmapEvents = mock(async () => {});
mock.module("../../../lib/heatmap-engine", () => ({
  getHeatmapEngine: () => ({ processEvents: mockProcessHeatmapEvents }),
}));

mock.module("../../../lib/logger", () => ({
  log: { child: () => ({ error: () => {}, debug: () => {}, info: () => {}, warn: () => {} }) },
}));

// ─── Dynamic import after mocks ───────────────────────────────────────────────

let enqueueEvents: (siteId: string, events: any[]) => void;
let enqueueFunnels: (siteId: string, events: any[]) => void;
let enqueueRecordings: (events: any[]) => void;
let enqueueHeatmaps: (events: any[]) => void;
let enqueueAutomations: (rows: any[]) => void;
let startIngestQueueFlusher: (cfg: AppConfig) => void;
let stopIngestQueueFlusher: () => void;
let flushIngestQueuesNow: () => Promise<void>;

// Minimal valid analytics event (type must not be in ANALYTICS_SKIP, ts required)
function ev(type = "pageview") {
  return { type, ts: 1_700_000_000_000 };
}

beforeAll(async () => {
  const mod = await import("../../../services/ingest/queues");
  enqueueEvents = mod.enqueueEvents;
  enqueueFunnels = mod.enqueueFunnels;
  enqueueRecordings = mod.enqueueRecordings;
  enqueueHeatmaps = mod.enqueueHeatmaps;
  enqueueAutomations = mod.enqueueAutomations;
  startIngestQueueFlusher = mod.startIngestQueueFlusher;
  stopIngestQueueFlusher = mod.stopIngestQueueFlusher;
  flushIngestQueuesNow = mod.flushIngestQueuesNow;

  // Small thresholds so we can exercise cap enforcement without huge arrays.
  // cap = maxEventsBeforeForceFlush * 2 (QUEUE_HARD_CAP_MULTIPLIER)
  startIngestQueueFlusher({
    ingestQueue: {
      flushMs: 60_000,
      maxEventsBeforeForceFlush: 5,
      maxRecordingsBeforeForceFlush: 5,
      maxHeatmapsBeforeForceFlush: 5,
      maxFunnelsBeforeForceFlush: 5,
      maxAutomationsBeforeForceFlush: 5,
    },
  } as AppConfig);
  stopIngestQueueFlusher(); // don't let the interval fire during tests
  await flushIngestQueuesNow(); // drain any events enqueued by setup
});

beforeEach(async () => {
  // Drain leftover state, then clear call histories.
  await flushIngestQueuesNow();
  mockDbValues.mockClear();
  mockDbInsert.mockClear();
  mockDbTxInsert.mockClear();
  mockProcessReplayEvents.mockClear();
  mockProcessHeatmapEvents.mockClear();
  mockIngestAutomationTriggersBatch.mockClear();
});

// ─── enqueueEvents ────────────────────────────────────────────────────────────

describe("enqueueEvents", () => {
  it("no-ops for empty array (no DB insert)", async () => {
    enqueueEvents("s1", []);
    await flushIngestQueuesNow();
    expect(mockDbValues).not.toHaveBeenCalled();
  });

  it("inserts enqueued events into the DB on flush", async () => {
    enqueueEvents("site1", [ev()]);
    await flushIngestQueuesNow();
    expect(mockDbValues).toHaveBeenCalledTimes(1);
    const rows = (mockDbValues.mock.calls[0] as any)[0] as any[];
    expect(rows.length).toBe(1);
  });

  it("accumulates events for the same site into one insert", async () => {
    enqueueEvents("site1", [ev()]);
    enqueueEvents("site1", [ev(), ev()]);
    await flushIngestQueuesNow();
    expect(mockDbValues).toHaveBeenCalledTimes(1);
    const rows = (mockDbValues.mock.calls[0] as any)[0] as any[];
    expect(rows.length).toBe(3);
  });

  it("flushes events for different sites via separate DB calls", async () => {
    enqueueEvents("site1", [ev()]);
    enqueueEvents("site2", [ev()]);
    await flushIngestQueuesNow();
    expect(mockDbValues).toHaveBeenCalledTimes(2);
  });

  it("drops events beyond the hard cap (threshold=5 → cap=10)", async () => {
    // Enqueue 15 at once; only 10 fit in the cap.
    enqueueEvents("site1", Array.from({ length: 15 }, () => ev()));
    await flushIngestQueuesNow();
    const allRows = (mockDbValues.mock.calls as any[]).flatMap((call: any[]) => call[0] as any[]);
    expect(allRows.length).toBe(10);
  });

  it("queue is empty after flush — second flush is a no-op", async () => {
    enqueueEvents("site1", [ev()]);
    await flushIngestQueuesNow();
    mockDbValues.mockClear();
    await flushIngestQueuesNow();
    expect(mockDbValues).not.toHaveBeenCalled();
  });
});

// ─── enqueueFunnels ───────────────────────────────────────────────────────────

describe("enqueueFunnels", () => {
  it("no-ops for empty array", async () => {
    enqueueFunnels("s1", []);
    await flushIngestQueuesNow();
    expect(mockDbValues).not.toHaveBeenCalled();
  });

  it("inserts funnel events into the DB on flush", async () => {
    enqueueFunnels("site1", [ev("funnel_step")]);
    await flushIngestQueuesNow();
    expect(mockDbValues).toHaveBeenCalledTimes(1);
  });

  it("flushes funnels for multiple sites with separate DB calls", async () => {
    enqueueFunnels("site1", [ev()]);
    enqueueFunnels("site2", [ev()]);
    await flushIngestQueuesNow();
    expect(mockDbValues).toHaveBeenCalledTimes(2);
  });
});

// ─── enqueueRecordings ────────────────────────────────────────────────────────

describe("enqueueRecordings", () => {
  it("no-ops for empty array", async () => {
    enqueueRecordings([]);
    await flushIngestQueuesNow();
    expect(mockProcessReplayEvents).not.toHaveBeenCalled();
  });

  it("passes recordings to the replay engine on flush", async () => {
    const recordings = [{ sid: "s1", events: [] }];
    enqueueRecordings(recordings);
    await flushIngestQueuesNow();
    expect(mockProcessReplayEvents).toHaveBeenCalledWith(recordings);
  });

  it("queue is empty after flush", async () => {
    enqueueRecordings([{ sid: "r1" }]);
    await flushIngestQueuesNow();
    mockProcessReplayEvents.mockClear();
    await flushIngestQueuesNow();
    expect(mockProcessReplayEvents).not.toHaveBeenCalled();
  });
});

// ─── enqueueHeatmaps ──────────────────────────────────────────────────────────

describe("enqueueHeatmaps", () => {
  it("no-ops for empty array", async () => {
    enqueueHeatmaps([]);
    await flushIngestQueuesNow();
    expect(mockProcessHeatmapEvents).not.toHaveBeenCalled();
  });

  it("passes heatmaps to the heatmap engine on flush", async () => {
    const heatmaps = [{ type: "heatmap_click", nx: 0.5 }];
    enqueueHeatmaps(heatmaps);
    await flushIngestQueuesNow();
    expect(mockProcessHeatmapEvents).toHaveBeenCalledWith(heatmaps);
  });

  it("queue is empty after flush", async () => {
    enqueueHeatmaps([{ type: "heatmap_scroll" }]);
    await flushIngestQueuesNow();
    mockProcessHeatmapEvents.mockClear();
    await flushIngestQueuesNow();
    expect(mockProcessHeatmapEvents).not.toHaveBeenCalled();
  });
});

// ─── enqueueAutomations ───────────────────────────────────────────────────────

describe("enqueueAutomations", () => {
  it("no-ops for empty array", async () => {
    enqueueAutomations([]);
    await flushIngestQueuesNow();
    expect(mockIngestAutomationTriggersBatch).not.toHaveBeenCalled();
  });

  it("passes automation rows to the automation batch on flush", async () => {
    const rows = [{ websiteUuid: "w1", automationId: "a1", occurredAt: new Date(), detail: {} }];
    enqueueAutomations(rows);
    await flushIngestQueuesNow();
    expect(mockIngestAutomationTriggersBatch).toHaveBeenCalledWith(rows);
  });

  it("queue is empty after flush", async () => {
    enqueueAutomations([{ websiteUuid: "w1", automationId: "a1", occurredAt: new Date(), detail: {} }]);
    await flushIngestQueuesNow();
    mockIngestAutomationTriggersBatch.mockClear();
    await flushIngestQueuesNow();
    expect(mockIngestAutomationTriggersBatch).not.toHaveBeenCalled();
  });
});

// ─── Mixed flush ──────────────────────────────────────────────────────────────

describe("flushIngestQueuesNow – mixed batch", () => {
  it("flushes all queue types in one call", async () => {
    enqueueEvents("s1", [ev()]);
    enqueueRecordings([{ sid: "r1" }]);
    enqueueHeatmaps([{ type: "heatmap_click" }]);
    enqueueAutomations([{ websiteUuid: "w1", automationId: "a1", occurredAt: new Date(), detail: {} }]);
    enqueueFunnels("s1", [ev()]);
    await flushIngestQueuesNow();
    // Events + funnels both write to DB (2 calls for "s1")
    expect(mockDbValues.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockProcessReplayEvents).toHaveBeenCalledTimes(1);
    expect(mockProcessHeatmapEvents).toHaveBeenCalledTimes(1);
    expect(mockIngestAutomationTriggersBatch).toHaveBeenCalledTimes(1);
  });
});
