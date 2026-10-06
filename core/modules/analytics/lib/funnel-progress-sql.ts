import { pagePathSql } from "./dimension-sql";

import { MAX_FUNNEL_STEPS, type FunnelProgressStep } from "../interfaces";

export type { FunnelProgressStep };

export { MAX_FUNNEL_STEPS };
const MAX_PATTERN_CHARS = 500;

/** `/pricing/` and `/pricing` are the same page; the root stays `/`. Mirrors the goal reports. */
export const normalizeFunnelPath = (path: string) => path.replace(/\/+$/, "") || "/";

/**
 * The query that counts, for each step, the visitors who reached it after reaching the one
 * before.
 *
 * Computed from the page views and events the server stores, not from progress the browser
 * kept: a visitor who has not consented has no stored progress, but the server still links
 * their page views through the day's anonymous id, so their journey is the same sequence of
 * rows as anyone's. It also means a funnel can be edited and the history recounted.
 *
 * Each step is the earliest event, after the previous step's time, that matches it, per
 * visitor (the session when there is no visitor id). One event never serves two steps, because
 * each must come strictly after the last, and within the window when the funnel sets one. The
 * earliest match is the best one to take: it leaves the most time for the steps still to come.
 *
 * Returns the SQL text and its parameters, so the shape can be tested without a database.
 * Every value from a funnel definition goes in as a parameter; only the structure is text.
 */
export function buildFunnelProgressQuery(
  websiteId: string,
  steps: FunnelProgressStep[],
  startIso: string,
  endIso: string,
  /** Hours a visitor may take between one step and the next; none means no limit. */
  windowHours: number | null = null,
  sharedEvents = false,
): { text: string; params: unknown[] } {
  if (steps.length === 0) throw new Error("A funnel needs at least one step");
  if (steps.length > MAX_FUNNEL_STEPS) throw new Error(`A funnel can have at most ${MAX_FUNNEL_STEPS} steps`);

  const params: unknown[] = [websiteId, startIso, endIso];
  const param = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const path = pagePathSql("b.page");
  const normalizedPath = `coalesce(nullif(rtrim(${path}, '/'), ''), '/')`;

  const matches = (step: FunnelProgressStep): string => {
    if (step.kind === "event") {
      const name = param(step.event);
      // Newer data stores the event under its own name; older data as 'custom' with the name in properties.
      return `(b.event_type = ${name} OR (b.event_type = 'custom' AND b.properties->>'name' = ${name}))`;
    }
    const wanted = step.path.slice(0, MAX_PATTERN_CHARS);
    switch (step.match) {
      case "contains":    return `(b.event_type = 'pageview' AND strpos(${path}, ${param(wanted)}) > 0)`;
      case "starts_with": return `(b.event_type = 'pageview' AND starts_with(${path}, ${param(wanted)}))`;
      case "regex":       return `(b.event_type = 'pageview' AND ${path} ~ ${param(wanted)})`;
      default:            return `(b.event_type = 'pageview' AND ${normalizedPath} = ${param(normalizeFunnelPath(wanted))})`;
    }
  };

  // Only the kinds of event the funnel can use are read.
  const types = new Set<string>();
  for (const step of steps) {
    if (step.kind === "page") types.add("pageview");
    else { types.add("custom"); types.add(step.event); }
  }
  const typesParam = param([...types]);

  // Each step has to follow the one before within the window. Measured from the previous step,
  // not from the first, so taking the earliest match at every step stays the best choice.
  const within = windowHours === null ? "" : ` AND b.t <= p.t + make_interval(hours => ${param(windowHours)}::int)`;

  const ctes = steps.map((step, i) =>
    i === 0
      ? `s0 AS (SELECT b.vkey, min(b.t) AS t FROM base b WHERE ${matches(step)} GROUP BY b.vkey)`
      : `s${i} AS (SELECT b.vkey, min(b.t) AS t FROM base b JOIN s${i - 1} p ON p.vkey = b.vkey AND b.t > p.t${within} WHERE ${matches(step)} GROUP BY b.vkey)`,
  );

  const text = `
    WITH base AS (
      SELECT coalesce(nullif(trim(e.visitor_id), ''), e.session_id) AS vkey,
             e.occurred_at AS t, e.event_type, e.page, e.properties
      FROM ${sharedEvents ? "batch_events" : "analytics_events"} e
      WHERE e.website_id = $1
        AND e.occurred_at >= $2::timestamptz
        AND e.occurred_at <= $3::timestamptz
        AND e.event_type = ANY(${typesParam}::text[])
    ),
    ${ctes.join(",\n    ")}
    ${steps.map((_, i) => `SELECT ${i} AS step_order, count(*)::int AS cnt FROM s${i}`).join("\n    UNION ALL\n    ")}
  `;
  return { text, params };
}


/** A bounded batch shares one materialized read of the site's events. Values stay bound. */
export function buildFunnelProgressBatchQuery(websiteId: string,
  funnels: Array<{ id: string; steps: FunnelProgressStep[]; windowHours: number | null }>, startIso: string, endIso: string) {
  if (!funnels.length || funnels.length > 50) throw new Error('A funnel report batch must contain 1..50 funnels');
  const params: unknown[] = [websiteId, startIso, endIso];
  const reports = funnels.map(funnel => {
    const query = buildFunnelProgressQuery(websiteId, funnel.steps, startIso, endIso, funnel.windowHours, true);
    const offset = params.length;
    params.push(...query.params);
    const text = query.text.replace(/\$(\d+)/g, (_, index: string) => `$${Number(index) + offset}`);
    params.push(funnel.id);
    return `SELECT $${params.length}::text AS funnel_id, p.* FROM (${text}) p`;
  });
  return { params, text: `WITH batch_events AS MATERIALIZED (
    SELECT website_id, visitor_id, session_id, occurred_at, event_type, page, properties FROM analytics_events
    WHERE website_id = $1 AND occurred_at >= $2::timestamptz AND occurred_at <= $3::timestamptz
  ) ${reports.join(' UNION ALL ')}` };
}
