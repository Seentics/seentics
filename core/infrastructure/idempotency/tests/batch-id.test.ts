import { describe, expect, it } from "bun:test";
import { batchIdFor } from "../batch-id";

/**
 * The whole idempotency scheme rests on this function being stable, so these assert the
 * two properties the marker depends on: the same rows always produce the same id, and
 * different rows do not collide.
 *
 * No database here — that is the point of `batch-id.ts` being separate from
 * `applied-batches.ts`. The ingest queue imports only this, so its own tests stay
 * connection-free.
 */

function pageview(overrides: Record<string, unknown> = {}) {
  return {
    type: "pageview",
    ts: 1_767_225_600_000,
    sid: "sess_1",
    vid: "vis_1",
    page: "/pricing",
    ...overrides,
  };
}

describe("batchIdFor", () => {
  /**
   * The retry case. `flushAnalytics` re-queues the same array and flushes it again, so a
   * differing id would write the batch twice — `analytics_events` has no natural key to
   * conflict on.
   */
  it("is stable for the same rows", () => {
    const rows = [pageview(), pageview({ sid: "sess_2" })];
    expect(batchIdFor(rows)).toBe(batchIdFor(rows));
    expect(batchIdFor([...rows])).toBe(batchIdFor(rows));
  });

  /** Stable across processes too, or a redelivery after a restart writes twice. */
  it("depends only on content, not on identity or call order", () => {
    const a = batchIdFor([pageview()]);
    const b = batchIdFor([{ ...pageview() }]);
    expect(a).toBe(b);
  });

  it("separates batches that differ in any field", () => {
    const base = batchIdFor([pageview()]);
    expect(batchIdFor([pageview({ sid: "sess_2" })])).not.toBe(base);
    expect(batchIdFor([pageview({ ts: 1_767_225_600_001 })])).not.toBe(base);
    expect(batchIdFor([pageview({ page: "/about" })])).not.toBe(base);
  });

  it("separates batches that differ in length", () => {
    expect(batchIdFor([pageview(), pageview()])).not.toBe(batchIdFor([pageview()]));
  });

  /**
   * Order is part of the identity. Two flushes holding the same events in a different
   * order are different batches, and treating them as one would drop the second.
   */
  it("treats a reordered batch as a different batch", () => {
    const a = pageview({ sid: "a" });
    const b = pageview({ sid: "b" });
    expect(batchIdFor([a, b])).not.toBe(batchIdFor([b, a]));
  });

  it("returns a stable-width hex id", () => {
    expect(batchIdFor([pageview()])).toMatch(/^[0-9a-f]{32}$/);
    expect(batchIdFor([])).toMatch(/^[0-9a-f]{32}$/);
  });
});
