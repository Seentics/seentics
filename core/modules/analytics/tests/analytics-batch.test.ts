import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// mock.module must be called before any dynamic import of the module under test.
// Use dynamic import in beforeAll so these mocks are in place when analytics-batch loads.

/**
 * The repository writes on a caller-supplied transaction now, so the fake tx *is* the
 * seam — no `db.transaction` mock needed. That transaction comes from `applyBatchOnce`,
 * which is what makes the insert replay-safe; this file tests the projection and
 * chunking, not the guard.
 */
const mockValues = mock(() => Promise.resolve());
const mockInsert = mock(() => ({ values: mockValues }));
const fakeTx = { insert: mockInsert };

// Must export everything `db/index.ts` does, `sql` included. Bun's module mocks are
// process-global, so an incomplete stub here is not a local shortcut — it becomes the
// `db` module for every test file that runs after this one, and anything importing a
// missing export fails to load entirely.
mock.module("../../../db", () => ({
  db: { insert: mockInsert },
  sql: mock(async () => []),
  analyticsEvents: {},
  outbox: {},
  websites: {},
  websiteMembers: {},
}));

// A complete `Logger`: `child` must exist and must itself return a logger, because
// modules call `log.child(...)` at import time. Bun's module mocks are global, so an
// incomplete stub here breaks every other test file that imports the real logger.
mock.module("../../../platform/lib/logger", () => {
  const logger: Record<string, unknown> = {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
  logger.child = () => logger;
  return { log: logger };
});

// Dynamic import ensures mocks above are registered before the module loads.
let ingestAnalyticsBatch: (tx: any, websiteId: string, events: any[]) => Promise<number>;

beforeAll(async () => {
  const mod = await import("../repositories/analytics-batch.repository");
  ingestAnalyticsBatch = mod.ingestAnalyticsBatch;
});

beforeEach(() => {
  mockInsert.mockClear();
  mockValues.mockClear();
});

const NOW = Date.now();

function pageview(overrides: Record<string, unknown> = {}): any {
  return {
    type: "pageview",
    url: "/home",
    vid: "v1",
    sid: "s1",
    ts: NOW,
    data: {},
    ...overrides,
  };
}

/**
 * The rows handed to the mocked `.values(...)` call.
 *
 * A helper rather than `mockValues.mock.calls[0][0]` at each site: that indexes a
 * possibly-empty tuple, which TypeScript rightly rejects, and a test asserting on
 * `undefined[0]` fails with an unhelpful message anyway. The `any` is a deliberate
 * test-only escape — these are driver row objects with no exported type — and it is
 * confined to this one place instead of repeated six times.
 */
function insertedRows(): any[] {
  // `mock.calls` is typed as a list of empty tuples because the mock was created
  // without argument types, so the recorded arguments have to be widened to be read
  // at all. Done once, here.
  const call = mockValues.mock.calls[0] as unknown[] | undefined;
  if (!call) throw new Error("expected the batch insert to have called values()");
  return call[0] as any[];
}

describe("ingestAnalyticsBatch", () => {
  it("returns 0 for an empty event array without touching DB", async () => {
    const result = await ingestAnalyticsBatch(fakeTx, "site1", []);
    expect(result).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts a single pageview and returns 1", async () => {
    const result = await ingestAnalyticsBatch(fakeTx, "site1", [pageview()]);
    expect(result).toBe(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("filters out all events in the ANALYTICS_SKIP set", async () => {
    const skipped = [
      "rrweb", "session_error", "console_event", "network_event",
      "heatmap_click", "heatmap_scroll", "heatmap_screenshot",
      "heatmap_dom_snapshot", "automation_trigger",
    ];
    const events = skipped.map((type) => pageview({ type }));
    const result = await ingestAnalyticsBatch(fakeTx, "site1", events);
    expect(result).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("promotes custom event data.name to event_type", async () => {
    const event = pageview({ type: "custom", data: { name: "purchase", value: 49.99 } });
    await ingestAnalyticsBatch(fakeTx, "site1", [event]);
    const rows = insertedRows();
    expect(rows[0].eventType).toBe("purchase");
  });

  it("caps event_type at 64 characters", async () => {
    const event = pageview({ type: "a".repeat(100) });
    await ingestAnalyticsBatch(fakeTx, "site1", [event]);
    const rows = insertedRows();
    expect(rows[0].eventType.length).toBe(64);
  });

  it("caps page URL at 2048 characters", async () => {
    const event = pageview({ url: "/" + "x".repeat(3000) });
    await ingestAnalyticsBatch(fakeTx, "site1", [event]);
    const rows = insertedRows();
    expect(rows[0].page.length).toBe(2048);
  });

  it("replaces oversized properties (>32KB) with { _truncated: true }", async () => {
    const event = pageview({ data: { payload: "x".repeat(33 * 1024) } });
    await ingestAnalyticsBatch(fakeTx, "site1", [event]);
    const rows = insertedRows();
    expect(rows[0].properties).toEqual({ _truncated: true });
  });

  it("keeps small properties object intact", async () => {
    const data = { plan: "pro", value: 99 };
    const event = pageview({ data });
    await ingestAnalyticsBatch(fakeTx, "site1", [event]);
    const rows = insertedRows();
    expect(rows[0].properties).toMatchObject(data);
  });

  /**
   * Chunked for the driver's parameter limit, all on the caller's transaction. There is
   * no inner transaction any more: `applyBatchOnce` already wraps this, so a partial
   * failure rolls the whole batch back together with the marker that would otherwise
   * record it as applied.
   */
  it("chunks batches over CHUNK_SIZE across several inserts on one transaction", async () => {
    const events = Array.from({ length: 3001 }, () => pageview());
    const result = await ingestAnalyticsBatch(fakeTx, "site1", events);
    expect(result).toBe(3001);
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("uses a single insert for batches at or below CHUNK_SIZE", async () => {
    const events = Array.from({ length: 100 }, () => pageview());
    await ingestAnalyticsBatch(fakeTx, "site1", events);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("counts only non-skipped events in mixed batch", async () => {
    const events = [
      pageview({ type: "rrweb" }),
      pageview({ type: "pageview" }),
      pageview({ type: "heatmap_click" }),
      pageview({ type: "custom", data: { name: "signup" } }),
    ];
    const result = await ingestAnalyticsBatch(fakeTx, "site1", events);
    expect(result).toBe(2);
  });

  it("attaches ingestMeta geo/device fields to the row", async () => {
    const event = pageview({
      ingestMeta: { country: "US", region: "CA", city: "SF", browser: "Chrome", device: "desktop", os: "macOS" },
    });
    await ingestAnalyticsBatch(fakeTx, "site1", [event]);
    const rows = insertedRows();
    expect(rows[0].country).toBe("US");
    expect(rows[0].region).toBe("CA");
    expect(rows[0].browser).toBe("Chrome");
    expect(rows[0].device).toBe("desktop");
  });
});
