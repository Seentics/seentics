import { describe, it, expect } from "bun:test";
import { clampClientTs } from "../../lib/client-timestamp";

const NOW = 1_700_000_000_000; // fixed reference epoch

describe("clampClientTs", () => {
  it("returns timestamp when within the 48h window", () => {
    const ts = NOW - 10 * 60 * 1000; // 10 minutes ago
    expect(clampClientTs(ts, NOW)).toBe(ts);
  });

  it("returns timestamp on the exact lower boundary (48h ago)", () => {
    const ts = NOW - 48 * 60 * 60 * 1000;
    expect(clampClientTs(ts, NOW)).toBe(ts);
  });

  it("returns now when timestamp is older than 48h", () => {
    const ts = NOW - 48 * 60 * 60 * 1000 - 1;
    expect(clampClientTs(ts, NOW)).toBe(NOW);
  });

  it("returns timestamp slightly in the future (within 5min)", () => {
    const ts = NOW + 2 * 60 * 1000; // 2 minutes ahead
    expect(clampClientTs(ts, NOW)).toBe(ts);
  });

  it("returns timestamp on the exact upper boundary (5min future)", () => {
    const ts = NOW + 5 * 60 * 1000;
    expect(clampClientTs(ts, NOW)).toBe(ts);
  });

  it("returns now when timestamp is more than 5min in the future", () => {
    const ts = NOW + 5 * 60 * 1000 + 1;
    expect(clampClientTs(ts, NOW)).toBe(NOW);
  });

  it("returns now for NaN", () => {
    expect(clampClientTs(NaN, NOW)).toBe(NOW);
  });

  it("returns now for Infinity", () => {
    expect(clampClientTs(Infinity, NOW)).toBe(NOW);
  });

  it("returns now for -Infinity", () => {
    expect(clampClientTs(-Infinity, NOW)).toBe(NOW);
  });

  it("returns now for a Unix-seconds timestamp (looks like year 1970)", () => {
    // Tracker bug: sends seconds instead of ms → value is ~1.7e9, which is 48h+ in the past
    const secondsTs = Math.floor(NOW / 1000); // ~1_700_000_000
    // This is 48h+ ago in ms terms, so clamped to now
    expect(clampClientTs(secondsTs, NOW)).toBe(NOW);
  });

  it("uses Date.now() when now is omitted", () => {
    const ts = Date.now();
    expect(clampClientTs(ts)).toBe(ts);
  });
});
