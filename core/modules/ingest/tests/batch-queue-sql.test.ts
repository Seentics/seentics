import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The claim query's shape, checked as text.
 *
 * It is raw SQL against a real database, so the honest unit test is not "does it return
 * the right rows" — it is "does Postgres accept it at all". That question has a
 * definite answer without a connection, and it is the one that actually went wrong:
 * `FOR UPDATE` was asked for alongside `DISTINCT`, which Postgres rejects outright, so
 * the queue threw on every poll and claimed nothing through this path for as long as the
 * code existed.
 *
 * Reading the source rather than the built query keeps this independent of a database
 * and of Drizzle's interpolation, and it fails for the one reason worth failing for.
 */

const SOURCE = readFileSync(
  join(import.meta.dir, "..", "repositories", "batch-queue.repository.ts"),
  "utf8",
);

/** The SQL inside the tagged template, with interpolations blanked out. */
function claimSql(): string {
  const start = SOURCE.indexOf("WITH oldest_per_key");
  const end = SOURCE.indexOf("`);", start);
  expect(start).toBeGreaterThan(-1);
  return SOURCE.slice(start, end).replace(/\$\{[^}]*\}/g, "?");
}

describe("claimPendingBatches SQL", () => {
  it("does not ask for FOR UPDATE and DISTINCT in one select", () => {
    // Postgres: "FOR UPDATE is not allowed with DISTINCT clause". It cannot know which
    // of the rows collapsed into a group it is meant to lock, so it refuses rather than
    // guessing — and the whole statement fails.
    const sql = claimSql();

    // Split on the CTE boundary: the dedupe lives inside, the lock outside.
    const cteEnd = sql.indexOf(")\n    SELECT");
    expect(cteEnd).toBeGreaterThan(-1);

    const cte = sql.slice(0, cteEnd);
    const outer = sql.slice(cteEnd);

    expect(cte).toContain("DISTINCT ON (partition_key)");
    expect(cte).not.toContain("FOR UPDATE");

    expect(outer).toContain("FOR UPDATE SKIP LOCKED");
    expect(outer).not.toContain("DISTINCT");
  });

  it("still picks the oldest batch per partition key", () => {
    // The guarantee the DISTINCT is there for: at most one batch per key in flight, so
    // two batches for the same replay session can never be applied concurrently.
    const cte = claimSql();
    expect(cte).toContain("DISTINCT ON (partition_key)");
    expect(cte).toContain("ORDER BY partition_key, created_at ASC");
  });

  it("skips rows another worker already holds", () => {
    // Without SKIP LOCKED a second worker blocks on the first's rows instead of taking
    // different work, and the queue serialises across the whole category.
    expect(claimSql()).toContain("SKIP LOCKED");
  });

  it("returns the oldest work first", () => {
    // `DISTINCT ON` must sort by its own key, so the age ordering has to be reapplied
    // outside it or the queue drains in partition-key order rather than by age.
    const sql = claimSql();
    const outer = sql.slice(sql.indexOf(")\n    SELECT"));
    expect(outer).toContain("ORDER BY b.created_at ASC");
  });

  it("bounds how much one poll claims", () => {
    expect(claimSql()).toContain("LIMIT");
  });

  it("only considers batches that are unfinished and under the attempt cap", () => {
    const cte = claimSql();
    expect(cte).toContain("completed_at IS NULL");
    expect(cte).toContain("attempts <");
  });
});
