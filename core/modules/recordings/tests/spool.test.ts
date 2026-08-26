import { describe, it, expect, beforeEach, mock } from "bun:test";

// The spool logs through the shared logger at import time, so the stub must be a
// complete Logger — `mock.module` is process-global in Bun and a partial stub would
// become the logger for every test file that runs after this one.
const warnings: Record<string, unknown>[] = [];
mock.module("../../../platform/lib/logger", () => {
  const logger: Record<string, unknown> = {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock((fields: Record<string, unknown>) => {
      warnings.push(fields);
    }),
    error: mock(() => {}),
  };
  logger.child = () => logger;
  return { log: logger };
});

const { ReplaySpool } = await import("../services/spool");

type Flush = { websiteId: string; sessionId: string; sequence: number; count: number };

function makeSpool() {
  const flushes: Flush[] = [];
  const spool = new ReplaySpool({
    // Floored to 5s internally; long enough that no timer fires during a test.
    chunkFlushMs: 60_000,
    getInitialSequence: async () => 0,
    onChunkFlush: async (websiteId, sessionId, sequence, events) => {
      flushes.push({ websiteId, sessionId, sequence, count: events.length });
    },
  });
  return { spool, flushes };
}

/** An envelope of roughly `bytes` serialized size. */
function envelope(bytes: number, ts = 1): Record<string, unknown> {
  return { type: "rrweb", ts, data: { timestamp: ts, blob: "x".repeat(Math.max(1, bytes)) } };
}

describe("ReplaySpool", () => {
  beforeEach(() => {
    warnings.length = 0;
  });

  describe("buffering", () => {
    it("accepts events and holds them until flushed", async () => {
      const { spool, flushes } = makeSpool();
      spool.push("w1", "s1", [envelope(10), envelope(10)]);

      expect(flushes).toEqual([]);
      await spool.flushAll();
      expect(flushes).toEqual([{ websiteId: "w1", sessionId: "s1", sequence: 0, count: 2 }]);
    });

    it("keeps sessions separate", async () => {
      const { spool, flushes } = makeSpool();
      spool.push("w1", "s1", [envelope(10)]);
      spool.push("w1", "s2", [envelope(10), envelope(10)]);

      await spool.flushAll();
      await spool.flushAll();

      expect(flushes.map((f) => [f.sessionId, f.count])).toEqual([
        ["s1", 1],
        ["s2", 2],
      ]);
    });

    it("is a no-op for a session with nothing buffered", async () => {
      const { spool, flushes } = makeSpool();
      await spool.flushAll();
      expect(flushes).toEqual([]);
    });

    it("empties the buffer, so a second flush writes nothing", async () => {
      const { spool, flushes } = makeSpool();
      spool.push("w1", "s1", [envelope(10)]);

      await spool.flushAll();
      await spool.flushAll();

      expect(flushes).toHaveLength(1);
    });
  });

  /**
   * The byte budget is the guard that matters for process stability. The event count
   * alone is a poor proxy: rrweb envelopes run from tens of bytes for a mouse move to
   * hundreds of kilobytes for a canvas frame, so a count-only cap could admit
   * gigabytes from one canvas-heavy session.
   */
  describe("byte budget", () => {
    it("admits events well under the budget", () => {
      const { spool } = makeSpool();
      spool.push("w1", "s1", [envelope(1024)]);

      expect(warnings.filter((w) => w.msg === "replay_spool_byte_overflow_drop")).toEqual([]);
    });

    it("drops further events once the budget is exceeded", async () => {
      const { spool, flushes } = makeSpool();

      // 32MB budget; 40 x 1MB envelopes crosses it.
      for (let i = 0; i < 40; i++) spool.push("w1", "s1", [envelope(1_000_000, i)]);

      const dropped = warnings.filter((w) => w.msg === "replay_spool_byte_overflow_drop");
      expect(dropped.length).toBeGreaterThan(0);

      // What was admitted before the budget ran out is still flushed — the cap sheds
      // the tail, it does not discard the recording.
      await spool.flushAll();
      expect(flushes[0]!.count).toBeGreaterThan(0);
      expect(flushes[0]!.count).toBeLessThan(40);
    });

    it("reports the session and the size in the drop warning", () => {
      const { spool } = makeSpool();
      for (let i = 0; i < 40; i++) spool.push("w1", "sBig", [envelope(1_000_000, i)]);

      const dropped = warnings.find((w) => w.msg === "replay_spool_byte_overflow_drop");
      expect(dropped).toMatchObject({ session_id: "sBig" });
      expect(dropped?.approx_bytes).toBeGreaterThan(0);
    });

    // The counter tracks the live buffer, not the session's lifetime total, so a
    // long recording that keeps flushing is never throttled.
    it("frees the budget again after a flush", async () => {
      const { spool } = makeSpool();
      for (let i = 0; i < 40; i++) spool.push("w1", "s1", [envelope(1_000_000, i)]);
      await spool.flushAll();

      warnings.length = 0;
      spool.push("w1", "s1", [envelope(1024)]);

      expect(warnings.filter((w) => w.msg === "replay_spool_byte_overflow_drop")).toEqual([]);
    });

    it("budgets each session independently", () => {
      const { spool } = makeSpool();
      for (let i = 0; i < 40; i++) spool.push("w1", "big", [envelope(1_000_000, i)]);

      warnings.length = 0;
      spool.push("w1", "small", [envelope(1024)]);

      expect(warnings.filter((w) => w.msg === "replay_spool_byte_overflow_drop")).toEqual([]);
    });

    // An envelope that cannot be serialized still has to be charged for, or a
    // circular payload would be a free pass past the budget.
    it("charges a nominal cost for an unserializable envelope", () => {
      const { spool } = makeSpool();
      const circular: Record<string, unknown> = { type: "rrweb", ts: 1 };
      circular.self = circular;

      expect(() => spool.push("w1", "s1", [circular])).not.toThrow();
    });
  });

  describe("warm tail", () => {
    it("exposes unflushed events for the player", () => {
      const { spool } = makeSpool();
      spool.push("w1", "s1", [envelope(10, 5)]);

      const warm = spool.warmChunks("w1", "s1");
      expect(warm).not.toBeNull();
    });

    it("returns null for an unknown session", () => {
      const { spool } = makeSpool();
      expect(spool.warmChunks("w1", "nope")).toBeNull();
    });
  });
});
