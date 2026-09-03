import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import type { HeatmapTrackerEvent } from "../services/tracker-mapping";
import type { ScreenshotJob } from "../../../platform/lib/types";

process.env.DATABASE_URL ??= "postgres://test-not-connected";

/**
 * The engine's buffering and flush.
 *
 * Untested until the file was split, and not for want of trying: reaching this behaviour
 * meant constructing a class that read `env().s3.bucket`, opened a timer, and pulled S3,
 * Playwright and the layout tables in through its own screenshot path. What was actually
 * interesting — batch grouping, the buffer cap, which points get announced — was three
 * dependencies deep behind all of that.
 *
 * Now the snapshot service is injectable and the row mapping lives in `point-mapping`, so
 * the only stubs left are the two things the engine genuinely talks to: the upsert and
 * the batch marker.
 *
 * The property under test throughout is the one the doc comment calls out: a batch must
 * not be split across two guarded writes, because the marker guards a whole batch and the
 * upsert *adds* to intensity. A split batch that half-fails re-inflates on redelivery.
 */

const upserts: { rows: unknown[] }[] = [];
let upsertThrowsFor: string | null = null;

mock.module("../repositories/heatmap-writes.repository", () => ({
  batchUpsertPoints: async (_tx: unknown, rows: unknown[]) => {
    upserts.push({ rows });
    return rows.length;
  },
  deleteHeatmaps: async () => {},
}));

/** Batch ids already applied, standing in for the marker table. */
const applied = new Set<string>();

mock.module("../../../infrastructure/idempotency", () => ({
  applyBatchOnceSql: async (
    batchId: string,
    _category: string,
    write: (tx: unknown) => Promise<number>,
  ) => {
    if (upsertThrowsFor === batchId) throw new Error("pg exploded");
    if (applied.has(batchId)) return { applied: false, rowCount: 0 };
    const rowCount = await write({});
    applied.add(batchId);
    return { applied: true, rowCount };
  },
  applyBatchOnce: async () => ({ applied: true, rowCount: 0 }),
  pruneAppliedBatches: async () => 0,
  batchIdFor: (...parts: unknown[]) => parts.join(":"),
}));

const { HeatmapEngine } = await import("../services/heatmap-engine.service");

/** Records what the engine hands the snapshot half, without touching S3. */
class FakeSnapshots {
  screenshots: ScreenshotJob[] = [];
  domSnapshots: string[] = [];
  async storeScreenshot(job: ScreenshotJob) {
    this.screenshots.push(job);
  }
  async storeDomSnapshot(ev: { url?: string }) {
    this.domSnapshots.push(ev.url ?? "");
  }
}

const published: { name: string; payload: Record<string, unknown> }[] = [];
const eventBus = {
  async publish(name: string, payload: Record<string, unknown>) {
    published.push({ name, payload });
  },
} as never;

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";

function clickRow(websiteId: string, nx = 0.5, ny = 0.5): HeatmapTrackerEvent {
  return {
    websiteId,
    type: "heatmap_click",
    url: "https://example.com/pricing",
    ts: 1_770_000_000_000,
    clientUa: "Mozilla/5.0 (Macintosh)",
    data: { nx, ny, target: "button#buy" },
  } as unknown as HeatmapTrackerEvent;
}

let engine: InstanceType<typeof HeatmapEngine>;
let snapshots: FakeSnapshots;

beforeEach(() => {
  upserts.length = 0;
  published.length = 0;
  applied.clear();
  upsertThrowsFor = null;
  snapshots = new FakeSnapshots();
  engine = new HeatmapEngine(eventBus, null, snapshots as never);
});

afterEach(async () => {
  // Clears the interval the constructor armed; without it the test process never exits.
  await engine.shutdown();
});

describe("buffering", () => {
  it("does not write until a flush", async () => {
    await engine.processEvents("b1", [clickRow(SITE_A)]);
    expect(upserts).toEqual([]);
  });

  it("writes what was buffered on shutdown", async () => {
    await engine.processEvents("b1", [clickRow(SITE_A)]);
    await engine.shutdown();
    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.rows).toHaveLength(1);
  });

  it("ignores a batch with no heatmap events", async () => {
    await engine.processEvents("b1", []);
    await engine.shutdown();
    expect(upserts).toEqual([]);
  });
});

describe("batch grouping", () => {
  /**
   * One write per originating batch, never one per flush. The marker guards a whole
   * batch, so a batch split across two writes could half-apply and then re-inflate the
   * additive upsert on redelivery.
   */
  it("writes each ingest batch separately even when flushed together", async () => {
    await engine.processEvents("b1", [clickRow(SITE_A), clickRow(SITE_A, 0.1, 0.1)]);
    await engine.processEvents("b2", [clickRow(SITE_A, 0.2, 0.2)]);
    await engine.shutdown();

    expect(upserts).toHaveLength(2);
    expect(upserts.map((u) => u.rows.length).sort()).toEqual([1, 2]);
  });

  it("keeps points from one batch in a single write, across websites", async () => {
    await engine.processEvents("b1", [clickRow(SITE_A), clickRow(SITE_B)]);
    await engine.shutdown();

    // Grouped by batch, not by website — the marker is per batch.
    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.rows).toHaveLength(2);
  });

  it("skips a batch the marker has already seen", async () => {
    await engine.processEvents("b1", [clickRow(SITE_A)]);
    await engine.shutdown();
    upserts.length = 0;

    // Same batch id redelivered.
    await engine.processEvents("b1", [clickRow(SITE_A)]);
    await engine.shutdown();

    expect(upserts).toEqual([]);
  });
});

describe("announcing what was written", () => {
  it("publishes one event per website, counting that website's points", async () => {
    await engine.processEvents("b1", [
      clickRow(SITE_A),
      clickRow(SITE_A, 0.1, 0.1),
      clickRow(SITE_B),
    ]);
    await engine.shutdown();

    const counts = published
      .filter((p) => p.name === "heatmap.data_collected")
      .map((p) => [p.payload.websiteId, p.payload.pointCount]);

    expect(counts).toHaveLength(2);
    expect(new Map(counts as [string, number][])).toEqual(
      new Map([
        [SITE_A, 2],
        [SITE_B, 1],
      ]),
    );
  });

  it("announces nothing for a batch that was skipped as a repeat", async () => {
    await engine.processEvents("b1", [clickRow(SITE_A)]);
    await engine.shutdown();
    published.length = 0;

    await engine.processEvents("b1", [clickRow(SITE_A)]);
    await engine.shutdown();

    expect(published).toEqual([]);
  });

  /**
   * A failed write must not be announced. A consumer counting collected points would
   * otherwise count rows that were never stored.
   */
  it("announces nothing for a batch whose write failed", async () => {
    upsertThrowsFor = "b1";
    await engine.processEvents("b1", [clickRow(SITE_A)]);
    await engine.shutdown();

    expect(published).toEqual([]);
  });

  it("keeps sibling batches alive when one fails", async () => {
    upsertThrowsFor = "b1";
    await engine.processEvents("b1", [clickRow(SITE_A)]);
    await engine.processEvents("b2", [clickRow(SITE_B)]);
    await engine.shutdown();

    expect(upserts).toHaveLength(1);
    const announced = published.map((p) => p.payload.websiteId);
    expect(announced).toEqual([SITE_B]);
  });
});

describe("routing to the snapshot half", () => {
  it("does not send a DOM snapshot when layout capture is off", async () => {
    await engine.processEvents("b1", [
      {
        websiteId: SITE_A,
        type: "heatmap_dom_snapshot",
        url: "https://example.com/p",
        ts: 1,
        data: { html: "<html>".padEnd(200, "x") },
      } as unknown as HeatmapTrackerEvent,
    ]);
    await engine.shutdown();

    expect(snapshots.domSnapshots).toEqual([]);
  });
});
