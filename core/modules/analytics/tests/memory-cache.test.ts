import { describe, it, expect } from "bun:test";
import { MemoryCache } from "../../../modules/analytics/lib/memory-cache";

describe("MemoryCache", () => {
  describe("get / set", () => {
    it("returns undefined for missing key", () => {
      const c = new MemoryCache<string>(10);
      expect(c.get("missing")).toBeUndefined();
    });

    it("returns value after set", () => {
      const c = new MemoryCache<string>(10);
      c.set("k", "hello", 5000);
      expect(c.get("k")).toBe("hello");
    });

    it("stores different types", () => {
      const c = new MemoryCache<object>(10);
      const obj = { a: 1 };
      c.set("o", obj, 5000);
      expect(c.get("o")).toBe(obj);
    });

    it("overwrites existing key", () => {
      const c = new MemoryCache<number>(10);
      c.set("k", 1, 5000);
      c.set("k", 2, 5000);
      expect(c.get("k")).toBe(2);
    });
  });

  describe("TTL expiry", () => {
    it("returns undefined for expired entry", () => {
      const c = new MemoryCache<string>(10);
      c.set("k", "v", 1); // 1ms TTL
      // Artificially expire by checking after a tick
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(c.get("k")).toBeUndefined();
          resolve();
        }, 10);
      });
    });

    it("returns value before TTL expires", () => {
      const c = new MemoryCache<string>(10);
      c.set("k", "alive", 10_000);
      expect(c.get("k")).toBe("alive");
    });
  });

  describe("LRU eviction", () => {
    // Constructor enforces a minimum of 16 entries, so we must use 16 as the cap.

    it("does not grow beyond maxEntries (16)", () => {
      const c = new MemoryCache<number>(16);
      for (let i = 0; i < 20; i++) c.set(`k${i}`, i, 60_000);
      let count = 0;
      for (let i = 0; i < 20; i++) if (c.get(`k${i}`) !== undefined) count++;
      expect(count).toBeLessThanOrEqual(16);
    });

    it("newly set entry is always accessible after eviction", () => {
      const c = new MemoryCache<number>(16);
      for (let i = 0; i < 16; i++) c.set(`fill${i}`, i, 60_000);
      c.set("new", 99, 60_000); // triggers eviction of one existing entry
      expect(c.get("new")).toBe(99);
    });

    it("evicts exactly one entry when going one over capacity", () => {
      const c = new MemoryCache<number>(16);
      for (let i = 0; i < 16; i++) c.set(`k${i}`, i, 60_000);
      c.set("overflow", 999, 60_000);
      let count = 0;
      for (let i = 0; i < 16; i++) if (c.get(`k${i}`) !== undefined) count++;
      if (c.get("overflow") !== undefined) count++;
      expect(count).toBe(16); // exactly 16 entries remain
    });

    it("does not evict when updating an existing key", () => {
      const c = new MemoryCache<number>(16);
      c.set("a", 1, 60_000);
      c.set("b", 2, 60_000);
      c.set("a", 99, 60_000); // update — no eviction should happen
      expect(c.get("a")).toBe(99);
      expect(c.get("b")).toBe(2);
    });
  });

  describe("sweepExpired", () => {
    it("removes expired entries without throwing", () => {
      const c = new MemoryCache<string>(10);
      c.set("live", "v", 60_000);
      c.set("dead", "v", 1);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          c.sweepExpired();
          expect(c.get("live")).toBe("v");
          expect(c.get("dead")).toBeUndefined();
          resolve();
        }, 10);
      });
    });

    it("does not throw on empty cache", () => {
      const c = new MemoryCache<string>(10);
      expect(() => c.sweepExpired()).not.toThrow();
    });
  });

  describe("constructor floor", () => {
    it("enforces minimum of 16 entries", () => {
      const c = new MemoryCache<number>(1);
      // Should be able to store 16 entries without eviction
      for (let i = 0; i < 16; i++) c.set(`k${i}`, i, 60_000);
      for (let i = 0; i < 16; i++) expect(c.get(`k${i}`)).toBe(i);
    });
  });
});
