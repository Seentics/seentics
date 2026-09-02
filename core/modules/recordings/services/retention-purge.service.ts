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

      const cleared: { website_id: string; session_id: string }[] = [];
      for (const row of oldSessions) {
        try {
          await deleteSessionPrefix(options.bucket, row.website_id, row.session_id);
          cleared.push(row);
        } catch (e) {
          // Logged and skipped: an unreachable prefix must not stop the sweep, and the
          // row must outlive it so the next run can retry this session.
          storageFailures += 1;
          log.warn({
            msg: "retention_s3_replay_delete_failed",
            session_id: row.session_id,
            err: String(e),
          });
        }
      }

      /**
       * Nothing cleared: every row in this page is one whose objects could not be
       * deleted, so the same page comes back next time. Stop instead of spinning.
       */
      if (cleared.length === 0) break;

      sessionsPurged += cleared.length;

      await sql.begin(async (tx) => {
        for (const row of cleared) {
          const deleted = await tx`
            DELETE FROM session_replays
            WHERE website_id = ${row.website_id} AND session_id = ${row.session_id}
          `;
          rowsDeleted += affectedRows(deleted);
        }
      });

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
