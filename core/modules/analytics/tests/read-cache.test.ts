import { describe, it, expect, beforeEach } from "bun:test";
import { cachedRead, resetAnalyticsReadCache } from "../lib/read-cache";

/**
 * These run without `DATABASE_URL`, which is the point of one of them: config resolution
 * fails here exactly as it does in every other unit test in this module, and the read
 * still has to work — deduplicated and timed, just not stored.
 */
describe("cachedRead", () => {
  beforeEach(() => {
    resetAnalyticsReadCache();
  });

  it("runs the query and returns its value", async () => {
    const out = await cachedRead("pages", "site-1", { days: 7 }, "shared", async () => ({ n: 1 }));
    expect(out).toEqual({ n: 1 });
  });

  it("shares one query between concurrent identical reads", async () => {
    // The load-bearing case. Several panels ask overlapping questions at once and every
    // open tab refreshes on a timer, so without this a cold cache means N identical
    // queries against a database with very little headroom to absorb them.
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    const run = async () => {
      calls++;
      await gate;
      return { n: calls };
    };

    const a = cachedRead("pages", "site-1", { days: 7 }, "shared", run);
    const b = cachedRead("pages", "site-1", { days: 7 }, "shared", run);
    release();

    expect(await a).toEqual({ n: 1 });
    expect(await b).toEqual({ n: 1 });
    expect(calls).toBe(1);
  });

  it("does not merge reads that differ by website", async () => {
    let calls = 0;
    const run = async () => ({ n: ++calls });
    await Promise.all([
      cachedRead("pages", "site-1", { days: 7 }, "shared", run),
      cachedRead("pages", "site-2", { days: 7 }, "shared", run),
    ]);
    expect(calls).toBe(2);
  });

  it("does not merge reads that differ by operation", async () => {
    let calls = 0;
    const run = async () => ({ n: ++calls });
    await Promise.all([
      cachedRead("pages", "site-1", { days: 7 }, "shared", run),
      cachedRead("referrers", "site-1", { days: 7 }, "shared", run),
    ]);
    expect(calls).toBe(2);
  });

  it("treats the same filters in a different key order as one read", async () => {
    // Filters are assembled from URL parameters, so the same set genuinely arrives in
    // different orders. Keying on `JSON.stringify` alone would miss on the second.
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const run = async () => {
      calls++;
      await gate;
      return { n: calls };
    };

    const a = cachedRead("pages", "s", { days: 7, country: "BD" }, "shared", run);
    const b = cachedRead("pages", "s", { country: "BD", days: 7 }, "shared", run);
    release();
    await Promise.all([a, b]);

    expect(calls).toBe(1);
  });

  it("ignores empty filter values when keying", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const run = async () => {
      calls++;
      await gate;
      return { n: calls };
    };

    const a = cachedRead("pages", "s", { days: 7 }, "shared", run);
    const b = cachedRead("pages", "s", { days: 7, country: "" }, "shared", run);
    release();
    await Promise.all([a, b]);

    expect(calls).toBe(1);
  });

  it("deduplicates a realtime read without storing it", async () => {
    // `"none"` still shares one in-flight query — freshness costs nothing there — but the
    // next read after it settles must go back to the database.
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const run = async () => {
      calls++;
      await gate;
      return { n: calls };
    };

    const a = cachedRead("live_visitors", "s", null, "none", run);
    const b = cachedRead("live_visitors", "s", null, "none", run);
    release();
    await Promise.all([a, b]);
    expect(calls).toBe(1);

    await cachedRead("live_visitors", "s", null, "none", run);
    expect(calls).toBe(2);
  });

  it("releases the in-flight entry when the query throws", async () => {
    // A failed read that stayed in the map would wedge that key forever: every later
    // caller would await an already-rejected promise instead of retrying.
    let calls = 0;
    const boom = async () => {
      calls++;
      throw new Error("query failed");
    };

    await expect(cachedRead("pages", "s", null, "shared", boom)).rejects.toThrow("query failed");
    await expect(cachedRead("pages", "s", null, "shared", boom)).rejects.toThrow("query failed");
    expect(calls).toBe(2);
  });

  it("does not cache a rejected read", async () => {
    let calls = 0;
    const flaky = async () => {
      calls++;
      if (calls === 1) throw new Error("transient");
      return { ok: true };
    };

    await expect(cachedRead("pages", "s", null, "shared", flaky)).rejects.toThrow("transient");
    expect(await cachedRead("pages", "s", null, "shared", flaky)).toEqual({ ok: true });
  });
});
