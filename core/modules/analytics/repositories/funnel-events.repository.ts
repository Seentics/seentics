import { analyticsReadSql as pgSql } from "../../../db";
import { buildFunnelProgressBatchQuery, buildFunnelProgressQuery, type FunnelProgressStep } from "../lib/funnel-progress-sql";

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

/**
 * How far each visitor got through a funnel, counted from the page views and events themselves.
 *
 * Returns one row per step (`step_order` 0, 1, …) with the visitors who reached it in order,
 * and the completions (`-1`) as the last step's count, the shape the funnel report reads. See
 * {@link buildFunnelProgressQuery} for what counts as reaching a step.
 */
export async function countFunnelProgress(
  websiteId: string,
  steps: FunnelProgressStep[],
  startIso: string,
  endIso: string,
  windowHours: number | null = null,
): Promise<FunnelStepCount[]> {
  if (steps.length === 0) return [];
  const { text, params } = buildFunnelProgressQuery(websiteId, steps, startIso, endIso, windowHours);
  const rows = await pgSql.unsafe<FunnelStepCount[]>(text, params as never[]);
  const last = rows.find((r) => r.step_order === steps.length - 1);
  return [...rows, { step_order: -1, cnt: last?.cnt ?? 0 }];
}

/**
 * Whether the database accepts `pattern` as a regular expression.
 *
 * Asked of the database rather than a JavaScript engine, because the syntaxes differ: a named
 * group is fine in a browser and an error here, and it is the database that runs the pattern.
 */
export async function isValidRegexPattern(pattern: string): Promise<boolean> {
  // Back-references are what make Postgres's matcher exponential, and a funnel step runs its
  // pattern over every page view in the range on a small shared pool: refused, not run.
  if (/\\[1-9]/.test(pattern)) return false;
  try {
    await pgSql`SELECT '' ~ ${pattern} AS ok`;
    return true;
  } catch (error) {
    // 2201B: invalid_regular_expression. Anything else is a fault, not an answer.
    if ((error as { code?: string }).code === "2201B") return false;
    throw error;
  }
}


export async function countFunnelsProgress(websiteId: string,
  funnels: Array<{ id: string; steps: FunnelProgressStep[]; windowHours: number | null }>, startIso: string, endIso: string): Promise<Record<string, FunnelStepCount[]>> {
  const result: Record<string, FunnelStepCount[]> = {};
  for (let offset = 0; offset < funnels.length; offset += 50) {
    const batch = funnels.slice(offset, offset + 50);
    const query = buildFunnelProgressBatchQuery(websiteId, batch, startIso, endIso);
    const rows = await pgSql.unsafe<Array<{ funnel_id: string; step_order: number; cnt: number }>>(query.text, query.params as never[]);
    for (const row of rows) (result[row.funnel_id] ??= []).push({ step_order: row.step_order, cnt: row.cnt });
    for (const funnel of batch) {
      const counts = result[funnel.id] ?? [];
      counts.push({ step_order: -1, cnt: counts.find(c => c.step_order === funnel.steps.length - 1)?.cnt ?? 0 });
      result[funnel.id] = counts;
    }
  }
  return result;
}
