import { sql } from "../../../db";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../../../platform/retention/interfaces";

/** Rows affected, from a driver result that may not report a count. */
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
 * Deletes aged rows from `analytics_events`, which this module owns.
 *
 * Funnel events and general events age out on different clocks, so they are two
 * statements over the same table rather than one. The predicates are complementary and
 * deliberately exhaustive: the general branch matches `event_type IS NULL` as well as
 * anything not in the funnel set, so a row with no type is still eligible instead of
 * living forever.
 */
export class AnalyticsRetentionPurge implements RetentionPurge {
  readonly name = "analytics";

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    _options: RetentionOptions,
  ): Promise<Record<string, number>> {
    // Keyed by the short website_id — `analytics_events.website_id` is text, not the UUID.
    const websiteId = target.websiteId;

    const funnel = await sql`
      DELETE FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type IN ('funnel_step', 'funnel_complete')
        AND occurred_at < ${cutoffs.funnelAutomation}
    `;

    const general = await sql`
      DELETE FROM analytics_events
      WHERE website_id = ${websiteId}
        AND (
          event_type IS NULL
          OR event_type NOT IN ('funnel_step', 'funnel_complete')
        )
        AND occurred_at < ${cutoffs.analytics}
    `;

    return {
      analyticsFunnelRows: affectedRows(funnel),
      analyticsGeneralRows: affectedRows(general),
    };
  }
}
