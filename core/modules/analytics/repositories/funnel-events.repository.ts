import { sql as pgSql } from "../../../db";

/** One bucket of the aggregation: a step index (or `-1`) and its distinct visitors. */
export type FunnelStepCount = { step_order: number | null; cnt: number };

/**
 * Tracker funnel events, bucketed by step.
 *
 * Takes `websiteId` — the short public id — because `analytics_events.website_id` is a
 * `text` column that the ingest path writes from `website.website_id`. This is the one
 * query in the module that is *not* keyed by the website UUID, and passing the UUID
 * here returns zero rows rather than an error.
 *
 * One pass over the range: `funnel_complete` rows bucket to `step_order = -1`,
 * `funnel_step` rows to their `properties->>'step'` index. Counting distinct
 * visitors (falling back to session when the tracker sent no visitor id) is what
 * makes the conversion rate a people rate rather than an event rate.
 */
export async function countFunnelStepVisitors(
  websiteId: string,
  funnelId: string,
  startIso: string,
  endIso: string,
): Promise<FunnelStepCount[]> {
  return pgSql<FunnelStepCount[]>`
    SELECT
      CASE WHEN event_type = 'funnel_complete' THEN -1
           ELSE (properties->>'step')::int END AS step_order,
      COUNT(DISTINCT COALESCE(NULLIF(TRIM(visitor_id), ''), session_id))::int AS cnt
    FROM analytics_events
    WHERE website_id = ${websiteId}
      AND event_type IN ('funnel_step', 'funnel_complete')
      AND properties->>'funnel_id' = ${funnelId}
      AND occurred_at >= ${startIso}::timestamptz
      AND occurred_at <= ${endIso}::timestamptz
    GROUP BY step_order
    ORDER BY step_order ASC
  `;
}
