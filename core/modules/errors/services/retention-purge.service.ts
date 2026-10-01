import { sql } from "../../../db";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../../../platform/retention/interfaces";
import { affectedRows } from "../../../platform/retention";

/**
 * Ages out reported errors with the rest of a site's analytics.
 *
 * Error events carry the visitor and session they happened to, and were kept for ever:
 * nothing in the retention sweep reached this module. A group goes once its last
 * occurrence is past the window and no event of it is left — a group still being
 * reported, or with history inside the window, stays.
 */
export class ErrorsRetentionPurge implements RetentionPurge {
  readonly name = "errors";

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    _options: RetentionOptions,
  ): Promise<Record<string, number>> {
    const events = await sql`
      DELETE FROM error_events
      WHERE website_id = ${target.websiteId}::uuid
        AND occurred_at < ${cutoffs.analytics}
    `;
    const groups = await sql`
      DELETE FROM error_groups AS g
      WHERE g.website_id = ${target.websiteId}::uuid
        AND g.last_seen < ${cutoffs.analytics}
        AND NOT EXISTS (
          SELECT 1 FROM error_events e
          WHERE e.website_id = g.website_id AND e.fingerprint = g.fingerprint
        )
    `;
    return { errorEventRows: affectedRows(events), errorGroupRows: affectedRows(groups) };
  }
}
