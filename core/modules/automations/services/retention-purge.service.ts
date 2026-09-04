import { sql } from "../../../db";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../../../platform/retention/interfaces";
import { affectedRows } from "../../../platform/retention";

/**
 * Deletes aged execution history from `automation_events`.
 *
 * `automation_events` carries no website column — it is keyed by `automation_id` alone
 * — so scoping to a website requires the join through `automations`. That is also why
 * this cannot live in retention: the join encodes how this module relates its two
 * tables, which is exactly the knowledge the boundary is meant to contain.
 */
export class AutomationRetentionPurge implements RetentionPurge {
  readonly name = "automations";

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    _options: RetentionOptions,
  ): Promise<Record<string, number>> {
    const deleted = await sql`
      DELETE FROM automation_events AS ae
      USING automations AS a
      WHERE ae.automation_id = a.id
        AND a.website_id = ${target.websiteId}::uuid
        AND ae.created_at < ${cutoffs.funnelAutomation}
    `;

    return { automationExecutionRows: affectedRows(deleted) };
  }
}
