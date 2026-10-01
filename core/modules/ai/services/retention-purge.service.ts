import { sql } from "../../../db";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../../../platform/retention/interfaces";
import { affectedRows } from "../../../platform/retention";

/**
 * Ages out AI Mode history: each question, the SQL it ran and the answer, which can
 * quote the site's analytics. Kept for the analytics window, like the data it read.
 */
export class AiRetentionPurge implements RetentionPurge {
  readonly name = "ai";

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    _options: RetentionOptions,
  ): Promise<Record<string, number>> {
    const deleted = await sql`
      DELETE FROM ai_queries
      WHERE website_id = ${target.websiteId}::uuid
        AND created_at < ${cutoffs.analytics}
    `;
    return { aiQueryRows: affectedRows(deleted) };
  }
}
