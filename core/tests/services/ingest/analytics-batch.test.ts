import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// mock.module must be called before any dynamic import of the module under test.
// Use dynamic import in beforeAll so these mocks are in place when analytics-batch loads.

const mockValues = mock(() => Promise.resolve());
const mockInsert = mock(() => ({ values: mockValues }));
const mockTxValues = mock(() => Promise.resolve());
const mockTxInsert = mock(() => ({ values: mockTxValues }));
const mockTransaction = mock((fn: (tx: any) => Promise<void>) =>
  fn({ insert: mockTxInsert })
);

mock.module("../../../db", () => ({
  db: { insert: mockInsert, transaction: mockTransaction },
  analyticsEvents: {},
}));

mock.module("../../../lib/logger", () => ({
  log: {
    child: () => ({
      debug: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
    }),
  },
}));

// Dynamic import ensures mocks above are registered before the module loads.
let ingestAnalyticsBatch: (siteId: string, events: any[]) => Promise<number>;

beforeAll(async () => {
  const mod = await import("../../../services/ingest/analytics-batch");
  ingestAnalyticsBatch = mod.ingestAnalyticsBatch;
});

beforeEach(() => {
  mockInsert.mockClear();
  mockValues.mockClear();
  mockTransaction.mockClear();
  mockTxInsert.mockClear();
  mockTxValues.mockClear();
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

describe("ingestAnalyticsBatch", () => {
  it("returns 0 for an empty event array without touching DB", async () => {
    const result = await ingestAnalyticsBatch("site1", []);
    expect(result).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts a single pageview and returns 1", async () => {
    const result = await ingestAnalyticsBatch("site1", [pageview()]);
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
    const result = await ingestAnalyticsBatch("site1", events);
    expect(result).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("promotes custom event data.name to event_type", async () => {
    const event = pageview({ type: "custom", data: { name: "purchase", value: 49.99 } });
    await ingestAnalyticsBatch("site1", [event]);
    const rows = mockValues.mock.calls[0][0] as any[];
    expect(rows[0].eventType).toBe("purchase");
  });

  it("caps event_type at 64 characters", async () => {
    const event = pageview({ type: "a".repeat(100) });
    await ingestAnalyticsBatch("site1", [event]);
    const rows = mockValues.mock.calls[0][0] as any[];
    expect(rows[0].eventType.length).toBe(64);
  });

  it("caps page URL at 2048 characters", async () => {
    const event = pageview({ url: "/" + "x".repeat(3000) });
    await ingestAnalyticsBatch("site1", [event]);
    const rows = mockValues.mock.calls[0][0] as any[];
    expect(rows[0].page.length).toBe(2048);
  });

  it("replaces oversized properties (>32KB) with { _truncated: true }", async () => {
    const event = pageview({ data: { payload: "x".repeat(33 * 1024) } });
    await ingestAnalyticsBatch("site1", [event]);
    const rows = mockValues.mock.calls[0][0] as any[];
    expect(rows[0].properties).toEqual({ _truncated: true });
  });

  it("keeps small properties object intact", async () => {
    const data = { plan: "pro", value: 99 };
    const event = pageview({ data });
    await ingestAnalyticsBatch("site1", [event]);
    const rows = mockValues.mock.calls[0][0] as any[];
    expect(rows[0].properties).toMatchObject(data);
  });

  it("uses a transaction for batches over CHUNK_SIZE (3000 rows)", async () => {
    const events = Array.from({ length: 3001 }, () => pageview());
    const result = await ingestAnalyticsBatch("site1", events);
    expect(result).toBe(3001);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("uses a single insert for batches at or below CHUNK_SIZE", async () => {
    const events = Array.from({ length: 100 }, () => pageview());
    await ingestAnalyticsBatch("site1", events);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("counts only non-skipped events in mixed batch", async () => {
    const events = [
      pageview({ type: "rrweb" }),
      pageview({ type: "pageview" }),
      pageview({ type: "heatmap_click" }),
      pageview({ type: "custom", data: { name: "signup" } }),
    ];
    const result = await ingestAnalyticsBatch("site1", events);
    expect(result).toBe(2);
  });

  it("attaches ingestMeta geo/device fields to the row", async () => {
    const event = pageview({
      ingestMeta: { country: "US", region: "CA", city: "SF", browser: "Chrome", device: "desktop", os: "macOS" },
    });
    await ingestAnalyticsBatch("site1", [event]);
    const rows = mockValues.mock.calls[0][0] as any[];
    expect(rows[0].country).toBe("US");
    expect(rows[0].region).toBe("CA");
    expect(rows[0].browser).toBe("Chrome");
    expect(rows[0].device).toBe("desktop");
  });
});
