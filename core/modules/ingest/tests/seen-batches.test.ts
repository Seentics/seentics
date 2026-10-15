import { beforeEach, describe, expect, it } from "bun:test";
import { alreadyStored, markStored, resetSeenBatches } from "../lib/seen-batches";

describe("seen tracker batches", () => {
  beforeEach(resetSeenBatches);
  const t0 = 1_800_000_000_000;

  it("recognises a retried batch for an hour, per site, and ignores batches without an id", () => {
    expect(alreadyStored("w", "b1", t0)).toBe(false);
    markStored("w", "b1", t0);
    expect(alreadyStored("w", "b1", t0 + 59 * 60_000)).toBe(true);
    expect(alreadyStored("w", "b1", t0 + 61 * 60_000)).toBe(false);
    expect(alreadyStored("other", "b1", t0)).toBe(false);
    markStored("w", undefined, t0);
    expect(alreadyStored("w", undefined, t0)).toBe(false);
    expect(alreadyStored("w", "", t0)).toBe(false);
  });
});

describe("pieces of a batch split at page close", () => {
  beforeEach(resetSeenBatches);
  const t0 = 1_800_000_000_000;

  it("are repeats once the whole batch arrived, and new pieces otherwise", () => {
    markStored("w", "b1", t0);
    expect(alreadyStored("w", "b1#core", t0)).toBe(true);
    expect(alreadyStored("w", "b1#heatmaps0", t0)).toBe(true);
    // The whole batch never arrived: each piece is new, then a repeat of itself.
    expect(alreadyStored("w", "b2#core", t0)).toBe(false);
    markStored("w", "b2#core", t0);
    expect(alreadyStored("w", "b2#heatmaps0", t0)).toBe(false);
    expect(alreadyStored("w", "b2#core", t0)).toBe(true);
  });
});

describe("heatmap events resent when their page closed", () => {
  beforeEach(resetSeenBatches);
  const t0 = 1_800_000_000_000;

  it("are taken once per site, for an hour; events without an id are always kept", async () => {
    const { firstHeatmapSighting } = await import("../lib/seen-batches");
    expect(firstHeatmapSighting("w", "e1", t0)).toBe(true);
    expect(firstHeatmapSighting("w", "e1", t0 + 1000)).toBe(false);
    expect(firstHeatmapSighting("other", "e1", t0)).toBe(true);
    expect(firstHeatmapSighting("w", "e1", t0 + 61 * 60_000)).toBe(true);
    expect(firstHeatmapSighting("w", undefined, t0)).toBe(true);
    expect(firstHeatmapSighting("w", undefined, t0)).toBe(true);
  });
});
