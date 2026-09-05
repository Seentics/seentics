import { createHash } from "node:crypto";

/**
 * A batch id derived from the batch's own contents.
 *
 * Stable by construction, which is the property that matters: the same rows produce the
 * same id on an in-process retry, after a restart, and on a redelivery from a durable
 * queue. An id assigned at flush time would change on retry and defeat the marker in
 * `applied-batches.ts`.
 *
 * Hash the *input* events, never anything aggregated from them. Tracker events carry a
 * timestamp, session and visitor id, so byte-identical content means genuinely identical
 * data. Heatmap *cells* do not — aggregation discards per-event timestamps, so two
 * separate flushes each holding one click on the same pixel would hash alike and the
 * second would be wrongly skipped.
 *
 * Deliberately in its own file with no database import: the ingest queue needs this and
 * nothing else, and its tests run without a connection. Pulling it from the barrel would
 * drag `db` into that import graph — the same trap `OutboxPublisher` avoids by keeping
 * its store import type-only.
 */
export function batchIdFor(rows: readonly unknown[]): string {
  const hash = createHash("sha256");

  /*
   * Fed element by element rather than as one `JSON.stringify(rows)`.
   *
   * The digest is identical — the bytes below are exactly what serialising the array
   * produces, which matters because a change to the id would let a batch already queued
   * under the old one be applied twice. What changes is the peak cost: a flush can carry
   * fifty thousand events, and a screenshot batch several megabytes per event, so the
   * single-string form built one enormous string and hashed it, on Bun's one thread, while
   * `/collect` waited behind it. The driver then serialised the same payload again for the
   * jsonb column.
   *
   * This still walks every row, so it is linear either way. It just never holds more than
   * one row's serialisation at a time, which keeps the pause proportional to the largest
   * event instead of to the whole batch.
   */
  hash.update("[");
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) hash.update(",");
    // `JSON.stringify` returns `undefined` for `undefined` and for a function, where
    // serialising the array around it emits the literal `null`. Matching that is what
    // keeps the digest byte-identical to the single-string form.
    hash.update(JSON.stringify(rows[i]) ?? "null");
  }
  hash.update("]");

  return hash.digest("hex").slice(0, 32);
}
