import { describe, it, expect, beforeEach, mock } from "bun:test";
// Registers the shared infrastructure stubs. Must come before the module under test.
import { warnings, prefixDeletes, s3DeleteFailures, resetStubs } from "./support/stubs";

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
mock.module("../../../db", () => {
  const select = (limit: number) => table.slice(0, limit);

  // The sweep issues exactly two shapes: the batch SELECT, and DELETEs inside `begin`.
  const tagged = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    if (text.includes("SELECT")) {
      const limit = values[values.length - 1] as number;
      return Promise.resolve(select(limit));
    }
    if (text.includes("DELETE")) {
      const websiteId = values[0] as string;
      const sessionId = values[1] as string;
      const before = table.length;
      table = table.filter((r) => !(r.website_id === websiteId && r.session_id === sessionId));
      return Promise.resolve({ count: before - table.length });
    }
    return Promise.resolve([]);
  };
  (tagged as unknown as { begin: unknown }).begin = async (
    fn: (tx: unknown) => Promise<unknown>,
  ) => fn(tagged);

  return { sql: tagged };
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
});
