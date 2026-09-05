import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The claim query's shape, checked as text.
 *
 * It is raw SQL against a real database, so the honest unit test is not "does it return
 * the right rows" — it is "does Postgres accept it, and does it still say what it is
 * supposed to say". Both questions have definite answers without a connection, and both
 * have gone wrong here before.
 *
 * The first was syntactic: `FOR UPDATE` asked for alongside `DISTINCT`, which Postgres
 * rejects outright, so the queue threw on every poll and claimed nothing.
 *
 * The second was worse because it ran. The query claimed by taking `FOR UPDATE SKIP
 * LOCKED` through `db.execute` — one autocommit statement, so every lock was released
 * before the caller had applied anything. Two workers took the same row, and two batches
 * for one partition key ran at once, which is exactly what the partition key exists to
 * prevent. A claim that is not written down is not a claim, and the tests below are what
 * stops it becoming a lock again.
 *
 * Reading the source rather than the built query keeps this independent of a database
 * and of Drizzle's interpolation, and it fails for the reasons worth failing for.
 */

const SOURCE = readFileSync(
  join(import.meta.dir, "..", "repositories", "batch-queue.repository.ts"),
  "utf8",
);

/** The SQL inside the tagged template, with interpolations blanked out. */
function claimSql(): string {
  const start = SOURCE.indexOf("WITH leased");
  const end = SOURCE.indexOf("`);", start);
  expect(start).toBeGreaterThan(-1);
  return SOURCE.slice(start, end).replace(/\$\{[^}]*\}/g, "?");
}

/** The three CTEs and the statement they feed, split apart. */
function parts() {
  const sql = claimSql();
  const candidatesAt = sql.indexOf("candidates AS (");
  const oldestAt = sql.indexOf("oldest AS (");
  const lockedAt = sql.indexOf("locked AS (");
  const updateAt = sql.indexOf("UPDATE ingest_batches t");
  expect(candidatesAt).toBeGreaterThan(-1);
  expect(oldestAt).toBeGreaterThan(candidatesAt);
  expect(lockedAt).toBeGreaterThan(oldestAt);
  expect(updateAt).toBeGreaterThan(lockedAt);
  return {
    sql,
    leased: sql.slice(0, candidatesAt),
    candidates: sql.slice(candidatesAt, oldestAt),
    oldest: sql.slice(oldestAt, lockedAt),
    locked: sql.slice(lockedAt, updateAt),
    update: sql.slice(updateAt),
  };
}

describe("claimPendingBatches SQL", () => {
  it("writes the claim down instead of relying on a lock", () => {
    // The regression this file exists for. `db.execute` is one autocommit statement, so a
    // lock taken here is gone by the time the worker applies anything. Only `claimed_at`
    // survives the statement, which makes it the only thing that can mean "claimed".
    const { update } = parts();
    expect(update).toContain("SET claimed_at = now()");
    expect(update).toContain("RETURNING");
  });

  it("does not ask for FOR UPDATE and DISTINCT in one select", () => {
    // Postgres: "FOR UPDATE is not allowed with DISTINCT clause". It cannot know which
    // of the rows collapsed into a group it is meant to lock, so it refuses rather than
    // guessing — and the whole statement fails.
    const { candidates, locked } = parts();

    expect(candidates).toContain("DISTINCT ON (b.partition_key)");
    expect(candidates).not.toContain("FOR UPDATE");

    expect(locked).toContain("FOR UPDATE SKIP LOCKED");
    expect(locked).not.toContain("DISTINCT");
  });

  it("leaves a partition key alone while one of its batches is in flight", () => {
    // The ordering guarantee, and the reason recordings key on session id: two batches for
    // one replay session must never be applied concurrently, or they are assigned the same
    // chunk sequence and overwrite each other in object storage.
    const { leased, candidates } = parts();
    expect(leased).toContain("claimed_at IS NOT NULL");
    expect(leased).toContain("claimed_at > now() -");
    expect(candidates).toContain("NOT EXISTS (SELECT 1 FROM leased l WHERE l.partition_key = b.partition_key)");
  });

  it("still picks the oldest batch per partition key", () => {
    const { candidates } = parts();
    expect(candidates).toContain("DISTINCT ON (b.partition_key)");
    expect(candidates).toContain("ORDER BY b.partition_key, b.created_at ASC");
  });

  it("skips rows another worker already holds", () => {
    // Without SKIP LOCKED a second worker blocks on the first's rows instead of taking
    // different work, and the queue serialises across the whole category.
    expect(parts().locked).toContain("SKIP LOCKED");
  });

  it("re-checks the lease on the row it is taking", () => {
    // Under READ COMMITTED a worker that blocks on a row another just claimed re-evaluates
    // this predicate against the committed version. Without it, it would overwrite the
    // other worker's claim and both would apply the batch.
    const { update } = parts();
    expect(update).toContain("t.claimed_at IS NULL OR t.claimed_at <=");
    expect(update).toContain("t.completed_at IS NULL");
  });

  it("bounds one poll by age, not by partition key", () => {
    // `DISTINCT ON` must sort by its own key, so a LIMIT inside it takes the twenty
    // alphabetically-lowest keys on every poll and starves everything above them. The
    // bound belongs after age ordering has been reapplied.
    const { candidates, oldest } = parts();
    expect(candidates).not.toContain("LIMIT");
    expect(oldest).toContain("ORDER BY created_at ASC");
    expect(oldest).toContain("LIMIT");
  });

  it("only considers batches that are unfinished and under the attempt cap", () => {
    const { candidates } = parts();
    expect(candidates).toContain("b.completed_at IS NULL");
    expect(candidates).toContain("b.attempts <");
  });
});
