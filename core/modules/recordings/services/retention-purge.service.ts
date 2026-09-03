import { sql } from "../../../db";
import { deleteSessionPrefix } from "../../../platform/lib/s3";
import { log as baseLog } from "../../../platform/lib/logger";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../../../platform/retention/interfaces";

const log = baseLog.child({ category: "retention" });

/**
 * Prefix deletes in flight at once.
 *
 * High enough to hide per-request latency, low enough not to look like a burst to the
 * storage provider. The sweep is a background job — throughput matters, arrival rate
 * does not.
 */
const STORAGE_CONCURRENCY = 8;

function affectedRows(result: unknown): number {
  if (
    result &&
    typeof result === "object" &&
    "count" in result &&
    typeof (result as { count: unknown }).count === "number"
  ) {
    return (result as { count: number }).count;
  }
  return 0;
}

/**
 * Deletes aged recordings — both the `session_replays` rows and the stored chunks.
 *
 * Batched rather than swept in one statement because every session also implies
 * object-storage deletes; an unbounded pass would hold a transaction open across
 * thousands of network round trips.
 *
 * Storage is cleared *before* the rows, and only the sessions whose storage delete
 * actually succeeded have their rows removed. The row is the sole pointer to the objects
 * — retention enumerates its work from this table — so deleting it after a failed prefix
 * delete strands those objects permanently. Leaving it means the next sweep retries.
 *
 * The cost is that a crash between the two can delete objects for a session whose row
 * survives, which reads as an empty recording — recoverable, unlike an unreferenced object.
 *
 * A session whose prefix delete keeps failing is therefore re-selected every pass. The
 * loop tracks that: a pass that clears nothing stops rather than spinning on the same rows.
 */
export class RecordingRetentionPurge implements RetentionPurge {
  readonly name = "recordings";

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    options: RetentionOptions,
  ): Promise<Record<string, number>> {
    let sessionsPurged = 0;
    let rowsDeleted = 0;

    let storageFailures = 0;

    for (;;) {
      const oldSessions = await sql<{ website_id: string; session_id: string }[]>`
        SELECT website_id, session_id
        FROM session_replays
        WHERE sequence = 0
          AND timestamp < ${cutoffs.replay}
          AND website_id = ${target.websiteId}
        LIMIT ${options.batchSize}
      `;
      if (oldSessions.length === 0) break;

      /*
       * Prefix deletes run `STORAGE_CONCURRENCY` at a time rather than one after another.
       * Each is a network round trip that the database is not waiting on, so a serial
       * loop made the sweep take `batchSize` round trips per page — the dominant cost of
       * the whole job, and the reason a large backlog could not be worked through in one
       * nightly window.
       *
       * Bounded rather than `Promise.all` over the page: an unbounded fan-out at a large
       * `batchSize` opens that many sockets at once and invites throttling from the
       * storage provider, which shows up as failures that strand objects for another day.
       *
       * Failure handling is unchanged and still per session — an unreachable prefix must
       * not stop the sweep, and its row must outlive the attempt so the next run retries.
       */
      const cleared: { website_id: string; session_id: string }[] = [];
      let cursor = 0;

      async function clearNext(): Promise<void> {
        for (;;) {
          const row = oldSessions[cursor++];
          if (!row) return;
          try {
            await deleteSessionPrefix(options.bucket, row.website_id, row.session_id);
            cleared.push(row);
          } catch (e) {
            storageFailures += 1;
            log.warn({
              msg: "retention_s3_replay_delete_failed",
              session_id: row.session_id,
              err: String(e),
            });
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(STORAGE_CONCURRENCY, oldSessions.length) }, clearNext),
      );

      /**
       * Nothing cleared: every row in this page is one whose objects could not be
       * deleted, so the same page comes back next time. Stop instead of spinning.
       */
      if (cleared.length === 0) break;

      sessionsPurged += cleared.length;

      /*
       * One statement for the page, not one per session. The pairs are matched with
       * `IN (VALUES …)` because a session id is only unique within its website, so the
       * two columns have to be compared together — and `(website_id, session_id)` is the
       * leading pair of the primary key, so the join finds each group by index.
       */
      const deleted = await sql`
        DELETE FROM session_replays
        WHERE (website_id, session_id) IN ${sql(
          cleared.map((r) => [r.website_id, r.session_id] as const),
        )}
      `;
      rowsDeleted += affectedRows(deleted);

      // A short page means the cutoff is exhausted apart from rows we deliberately kept.
      if (oldSessions.length < options.batchSize) break;
    }

    return {
      replaySessionsPurged: sessionsPurged,
      sessionReplayPgRows: rowsDeleted,
      /** Non-zero means objects were left in place on purpose; the next sweep retries them. */
      replayStorageDeleteFailures: storageFailures,
    };
  }
}
