import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule } from "../../../app/tests/helpers/fake-db";

/**
 * The gate for phase 0: a redelivered batch must change nothing.
 *
 * None of the four ingest write paths is naturally idempotent — `analytics_events` is a
 * plain insert with no natural key, `heatmap_points` upserts additively, and the flush
 * retries three times. So the correctness of every retry in the system reduces to the
 * behaviour asserted here.
 *
 * The database is faked at the module boundary. What matters is not the SQL but the
 * control flow: whether `write` runs, and whether it runs inside the same transaction as
 * the marker.
 */

/** Rows in the fake `ingest_applied_batches`, keyed by batch id. */
const markers = new Map<string, { category: string; rowCount: number }>();

/** Every transaction opened, so tests can assert the write shared one with the marker. */
let txCount = 0;

/** Set true if a write is ever handed something other than the live transaction. */
let escapedTx = false;

const fakeTx = {
  insert: () => ({
    values: (row: { batchId: string; category: string; rowCount: number }) => ({
      onConflictDoNothing: () => ({
        returning: async () => {
          if (markers.has(row.batchId)) return [];
          markers.set(row.batchId, { category: row.category, rowCount: row.rowCount });
          return [{ batchId: row.batchId }];
        },
      }),
    }),
  }),
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => {
          const found = [...markers.values()][0];
          return found ? [{ rowCount: found.rowCount }] : [];
        },
      }),
    }),
  }),
  update: () => ({
    set: (patch: { rowCount: number }) => ({
      where: async () => {
        const [first] = [...markers.keys()];
        if (first) markers.set(first, { ...markers.get(first)!, rowCount: patch.rowCount });
      },
    }),
  }),
};

// Table stubs come from the shared fake so this registration exports everything
// `db/index.ts` does. Bun materialises a mocked module namespace once and the first
// registration to be resolved wins for the whole run, so a partial stub here becomes
// every later module's `db`, and any module importing a table it omits fails to load.
// Only the pieces this file asserts on are overridden below.
mock.module("../../../db", () => ({
  ...fakeDbModule(),
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      txCount += 1;
      return fn(fakeTx);
    },
  },
  sql: mock(async () => []),
  ingestAppliedBatches: { batchId: "batch_id", appliedAt: "applied_at" },
}));

let applyBatchOnce: typeof import("../applied-batches").applyBatchOnce;

beforeAll(async () => {
  ({ applyBatchOnce } = await import("../applied-batches"));
});

beforeEach(() => {
  markers.clear();
  txCount = 0;
  escapedTx = false;
});

describe("applyBatchOnce", () => {
  it("runs the write on a fresh batch and reports what it wrote", async () => {
    let ran = 0;
    const result = await applyBatchOnce("batch_a", "analytics", async () => {
      ran += 1;
      return 42;
    });

    expect(ran).toBe(1);
    expect(result).toEqual({ applied: true, rowCount: 42 });
  });

  /**
   * The assertion phase 0 exists for. Replaying the identical batch must not call the
   * write a second time — for heatmaps that is the difference between a correct click
   * count and one silently inflated by however many times the batch was redelivered.
   */
  it("does not run the write again for a batch already applied", async () => {
    let ran = 0;
    const write = async () => {
      ran += 1;
      return 10;
    };

    const first = await applyBatchOnce("batch_a", "heatmaps", write);
    const second = await applyBatchOnce("batch_a", "heatmaps", write);

    expect(ran).toBe(1);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
  });

  /** A repeat reports the original count, so a caller's accounting stays truthful. */
  it("reports the recorded row count on a repeat", async () => {
    await applyBatchOnce("batch_a", "analytics", async () => 7);
    const repeat = await applyBatchOnce("batch_a", "analytics", async () => 7);
    expect(repeat.rowCount).toBe(7);
  });

  it("treats distinct batch ids independently", async () => {
    const a = await applyBatchOnce("batch_a", "analytics", async () => 1);
    const b = await applyBatchOnce("batch_b", "analytics", async () => 2);
    expect([a.applied, b.applied]).toEqual([true, true]);
    expect(markers.size).toBe(2);
  });

  /**
   * Marker and write in *one* transaction is the entire guarantee. Two transactions would
   * leave a window where the batch reads as applied but its rows are missing — worse than
   * no marker, because the retry would then skip the write that never happened.
   */
  it("writes the marker and the data in a single transaction", async () => {
    await applyBatchOnce("batch_a", "analytics", async (tx) => {
      // Compared as unknown: the parameter is typed as a real Drizzle transaction, and
      // the point of the assertion is that the *identity* matches the one the fake
      // transaction handed in.
      if ((tx as unknown) !== (fakeTx as unknown)) escapedTx = true;
      return 1;
    });

    expect(txCount).toBe(1);
    expect(escapedTx).toBe(false);
  });

  /**
   * A throwing write must propagate. The caller's retry depends on seeing the failure,
   * and the transaction rolling back is what un-records the marker so the retry is
   * allowed to run at all.
   */
  it("propagates a failing write", async () => {
    await expect(
      applyBatchOnce("batch_a", "analytics", async () => {
        throw new Error("insert failed");
      }),
    ).rejects.toThrow("insert failed");
  });

  it("records the category so a suspicious replay can be traced to a write path", async () => {
    await applyBatchOnce("batch_a", "heatmaps", async () => 3);
    expect(markers.get("batch_a")?.category).toBe("heatmaps");
  });
});
