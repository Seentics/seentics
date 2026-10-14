import { describe, expect, it } from "bun:test";
import { MAX_ATTEMPTS, RETRY_DELAYS_MS, retryDelayMs } from "../lib/backoff";

describe("retry schedule", () => {
  it("waits longer after each failure", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([30_000, 120_000, 600_000, 3_600_000, 21_600_000]);
    for (let i = 1; i < RETRY_DELAYS_MS.length; i++) expect(RETRY_DELAYS_MS[i]!).toBeGreaterThan(RETRY_DELAYS_MS[i - 1]!);
  });

  it("gives up after six attempts, about seven and a half hours in", () => {
    expect(MAX_ATTEMPTS).toBe(6);
    expect(retryDelayMs(6)).toBeNull();
    expect(retryDelayMs(99)).toBeNull();
    expect(RETRY_DELAYS_MS.reduce((a, b) => a + b, 0)).toBeLessThan(8 * 60 * 60 * 1000);
  });

  it("treats a delivery that has not been attempted as due for its first retry delay", () => {
    expect(retryDelayMs(0)).toBe(30_000);
  });
});
