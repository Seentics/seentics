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
