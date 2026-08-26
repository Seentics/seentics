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
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 32);
}
