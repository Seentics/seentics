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
 * Storage is cleared *before* the rows, deliberately. If it failed after, the row
 * would be gone and the objects orphaned with nothing left pointing at them; this way
 * a failure leaves the row in place and the next sweep retries it. The cost is that a
 * crash between the two can delete objects for a session whose row survives, which
 * reads as an empty recording — recoverable, unlike an unreferenced object.
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

    for (;;) {
      // Rows may be written under either identifier, so match both — see the
      // repository's list query for the same reason.
      const oldSessions = await sql<{ website_id: string; session_id: string }[]>`
        SELECT website_id, session_id
        FROM session_replays
        WHERE sequence = 0
          AND timestamp < ${cutoffs.replay}
          AND (website_id = ${target.siteId} OR website_id = ${target.websiteUuid})
        LIMIT ${options.batchSize}
      `;
      if (oldSessions.length === 0) break;

      sessionsPurged += oldSessions.length;

      for (const row of oldSessions) {
        try {
          await deleteSessionPrefix(options.bucket, row.website_id, row.session_id);
        } catch (e) {
          // Logged and skipped: an unreachable prefix must not stop the sweep. The row
          // stays, so the next run retries this session.
          log.warn({
            msg: "retention_s3_replay_delete_failed",
            session_id: row.session_id,
            err: String(e),
          });
        }
      }

      await sql.begin(async (tx) => {
        for (const row of oldSessions) {
          const deleted = await tx`
            DELETE FROM session_replays
            WHERE website_id = ${row.website_id} AND session_id = ${row.session_id}
          `;
          rowsDeleted += affectedRows(deleted);
        }
      });
    }

    return {
      replaySessionsPurged: sessionsPurged,
      sessionReplayPgRows: rowsDeleted,
    };
  }
}
