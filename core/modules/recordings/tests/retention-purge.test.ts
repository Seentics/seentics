import { describe, it, expect, beforeEach, mock } from "bun:test";
// Registers the shared infrastructure stubs. Must come before the module under test.
import * as stubs from "./support/stubs";
import { fakeDbModule } from "../../../app/tests/helpers/fake-db";
const { warnings, prefixDeletes, s3DeleteFailures, resetStubs } = stubs;

/**
 * Retention's contract is that the row outlives a failed storage delete.
 *
 * The row is the only pointer to a session's objects — this sweep enumerates its work
 * from `session_replays` — so deleting it after the prefix delete failed strands those
 * objects with nothing left that can ever find them again.
 */

type Row = { website_id: string; session_id: string };

/** Rows still in the table, in selection order. */
let table: Row[] = [];

/** How many DELETE statements the sweep issued — one per page, not one per session. */
let deleteStatements = 0;
mock.module("../../../db", () => {
  const select = (limit: number) => table.slice(0, limit);

  /** What `sql(pairs)` produces: a fragment the DELETE branch reads back. */
  type PairFragment = { __pairs: readonly (readonly [string, string])[] };
  const isPairs = (v: unknown): v is PairFragment =>
    !!v && typeof v === "object" && "__pairs" in v;

  /**
   * Two shapes now: the batch SELECT, and one DELETE per page.
   *
   * The DELETE takes every cleared `(website_id, session_id)` pair in a single
   * statement — it used to be one statement per session inside a transaction — so the
   * fake has to understand `sql(pairs)` being interpolated as a value list.
   */
  const tagged = (strings: TemplateStringsArray | unknown, ...values: unknown[]) => {
    // Called as a function rather than a template tag: `sql(pairs)` building a fragment.
    if (Array.isArray(strings) && !("raw" in (strings as object))) {
      return { __pairs: strings as readonly (readonly [string, string])[] };
    }

    const text = (strings as TemplateStringsArray).join("?");
    if (text.includes("SELECT")) {
      const limit = values[values.length - 1] as number;
      return Promise.resolve(select(limit));
    }
    if (text.includes("DELETE")) {
      deleteStatements += 1;
      const fragment = values.find(isPairs);
      const pairs = fragment ? fragment.__pairs : [];
      const before = table.length;
      table = table.filter(
        (r) => !pairs.some(([w, sid]) => r.website_id === w && r.session_id === sid),
      );
      return Promise.resolve({ count: before - table.length });
    }
    return Promise.resolve([]);
  };
  (tagged as unknown as { begin: unknown }).begin = async (
    fn: (tx: unknown) => Promise<unknown>,
  ) => fn(tagged);

  // Spread the shared fake, then override only `sql`. Returning `{ sql }` alone made this
  // the whole `db` module for every file loaded after it — and `db/index.ts` re-exports
  // twenty tables, so those files failed to *load* with `SyntaxError: Export named … not
  // found`, pointing at the real module rather than at this stub.
  return { ...fakeDbModule(), sql: tagged };
});

const { RecordingRetentionPurge } = await import("../services/retention-purge.service");

const target = { websiteId: "w1" } as never;
const cutoffs = { replay: new Date("2026-01-01T00:00:00Z") } as never;
const options = { bucket: "b", batchSize: 10 } as never;

function purge() {
  return new RecordingRetentionPurge().purge(target, cutoffs, options);
}

describe("RecordingRetentionPurge", () => {
  beforeEach(() => {
    table = [];
    deleteStatements = 0;
    resetStubs();
  });

  it("deletes rows whose objects were removed", async () => {
    table = [
      { website_id: "w1", session_id: "s1" },
      { website_id: "w1", session_id: "s2" },
    ];

    const out = await purge();

    expect(table).toEqual([]);
    expect(out).toMatchObject({ replaySessionsPurged: 2, sessionReplayPgRows: 2 });
  });

  it("keeps the row when the storage delete failed", async () => {
    table = [
      { website_id: "w1", session_id: "keep" },
      { website_id: "w1", session_id: "go" },
    ];
    s3DeleteFailures.add("keep");

    await purge();

    expect(table).toEqual([{ website_id: "w1", session_id: "keep" }]);
  });

  it("counts only the sessions it actually purged", async () => {
    table = [
      { website_id: "w1", session_id: "keep" },
      { website_id: "w1", session_id: "go" },
    ];
    s3DeleteFailures.add("keep");

    const out = await purge();

    expect(out).toMatchObject({
      replaySessionsPurged: 1,
      sessionReplayPgRows: 1,
      replayStorageDeleteFailures: 1,
    });
  });

  it("reports the failure rather than swallowing it", async () => {
    table = [{ website_id: "w1", session_id: "keep" }];
    s3DeleteFailures.add("keep");

    await purge();

    expect(warnings.some((w) => w.msg === "retention_s3_replay_delete_failed")).toBe(true);
  });

  /**
   * The rows it deliberately keeps are re-selected by the next iteration's SELECT, so
   * a pass that clears nothing has to stop rather than re-attempt the same page forever.
   */
  it("terminates when every session in the page fails", async () => {
    table = [
      { website_id: "w1", session_id: "a" },
      { website_id: "w1", session_id: "b" },
    ];
    s3DeleteFailures.add("a");
    s3DeleteFailures.add("b");

    const out = await purge();

    expect(prefixDeletes).toEqual(["a", "b"]);
    expect(out).toMatchObject({ replaySessionsPurged: 0 });
  });

  it("does nothing when there is nothing past the cutoff", async () => {
    const out = await purge();

    expect(prefixDeletes).toEqual([]);
    expect(out).toMatchObject({ replaySessionsPurged: 0, sessionReplayPgRows: 0 });
  });

  describe("cost of a page", () => {
    /**
     * The sweep's dominant cost is network, not SQL: one prefix delete per session,
     * `batchSize` sessions per page. Both of these were per-session round trips before —
     * a serial `await` for storage and a `DELETE` inside a transaction for each row.
     */
    it("issues one DELETE for the whole page, not one per session", async () => {
      table = Array.from({ length: 10 }, (_, i) => ({ website_id: "w1", session_id: `s${i}` }));

      await purge();

      expect(deleteStatements).toBe(1);
      expect(table).toEqual([]);
    });

    it("deletes exactly the sessions whose objects were cleared", async () => {
      table = Array.from({ length: 6 }, (_, i) => ({ website_id: "w1", session_id: `s${i}` }));
      s3DeleteFailures.add("s2");
      s3DeleteFailures.add("s4");

      await purge();

      // The two that failed keep their rows so the next sweep retries them.
      expect(table.map((r) => r.session_id).sort()).toEqual(["s2", "s4"]);
    });

    it("runs prefix deletes concurrently, but bounded", async () => {
      table = Array.from({ length: 10 }, (_, i) => ({ website_id: "w1", session_id: `s${i}` }));

      await purge();

      // All of them still happen; the change is how many are in flight at once.
      expect(prefixDeletes).toHaveLength(10);
      expect(stubs.maxConcurrentPrefixDeletes).toBeGreaterThan(1);
      expect(stubs.maxConcurrentPrefixDeletes).toBeLessThanOrEqual(8);
    });
  });
});
