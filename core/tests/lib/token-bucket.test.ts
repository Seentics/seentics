import { describe, it, expect, beforeEach } from "bun:test";
import { takeRateToken, pruneRateBuckets } from "../../lib/token-bucket";

// Each test uses a unique key prefix to avoid cross-test state pollution
let seq = 0;
function key(label: string) {
  return `test:${label}:${++seq}`;
}

describe("takeRateToken", () => {
  it("allows first request and returns full remaining minus one", () => {
    const r = takeRateToken(key("first"), 10, 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
    expect(r.limit).toBe(10);
  });

  it("decrements remaining on each call", () => {
    const k = key("decrement");
    takeRateToken(k, 5, 1000);
    takeRateToken(k, 5, 1000);
    const r = takeRateToken(k, 5, 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("rejects when limit is exhausted", () => {
    const k = key("exhaust");
    for (let i = 0; i < 3; i++) takeRateToken(k, 3, 60_000);
    const r = takeRateToken(k, 3, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("different keys are fully independent", () => {
    const a = key("ind-a");
    const b = key("ind-b");
    for (let i = 0; i < 5; i++) takeRateToken(a, 5, 1000);
    const r = takeRateToken(b, 5, 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("resets bucket when limit or windowMs changes", () => {
    const k = key("reset");
    for (let i = 0; i < 2; i++) takeRateToken(k, 2, 1000);
    // Change limit → bucket resets to full
    const r = takeRateToken(k, 10, 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
  });

  it("returns resetInMs > 0 when denied", () => {
    const k = key("resetMs");
    for (let i = 0; i < 2; i++) takeRateToken(k, 2, 5000);
    const r = takeRateToken(k, 2, 5000);
    expect(r.allowed).toBe(false);
    expect(r.resetInMs).toBeGreaterThan(0);
  });

  it("allows a limit-1 burst immediately", () => {
    const k = key("burst");
    const results = Array.from({ length: 5 }, () => takeRateToken(k, 5, 10_000));
    expect(results.every((r) => r.allowed)).toBe(true);
  });
});

describe("pruneRateBuckets", () => {
  it("does not throw on empty state", () => {
    expect(() => pruneRateBuckets(1)).not.toThrow();
  });

  it("removes buckets idle longer than maxIdleMs", async () => {
    const k = key("prune");
    takeRateToken(k, 10, 1000);
    // Wait to ensure the bucket's lastRefillMs is older than the prune threshold
    await Bun.sleep(5);
    pruneRateBuckets(4); // evict buckets idle > 4ms
    // After pruning, next call creates a fresh bucket
    const r = takeRateToken(k, 10, 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
  });
});
