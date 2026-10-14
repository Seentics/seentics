import { analyticsReadSql as pgSql } from "../../../db";
import type { ImpactCounts, ImpactCountsQuery } from "../interfaces";
import { CONVERSION_EVENTS } from "./insight-snapshot.repository";

/**
 * Session counts for one fixed window, for the AI module's before-and-after impact reports.
 *
 * One pass over the window's events grouped by session, the same session shape the daily insight
 * snapshot uses (first pageview's device and channel, one-pageview sessions as bounces), optionally
 * narrowed to sessions that entered on a page, came from a channel, or used a device. Counts only.
 *
 * The conversion event is the caller's to fix: a baseline names the event it counted, so a later
 * reading counts the same one even if another event has since become more common. Without one, the
 * window's most frequent recognised conversion event is used and returned.
 */
export async function getImpactCounts(websiteId: string, q: ImpactCountsQuery): Promise<ImpactCounts> {
  const from = q.from.toISOString();
  const to = q.to.toISOString();

  let event = q.event ?? null;
  if (q.event === undefined) {
    const [row] = await pgSql<{ event: string }[]>`
      SELECT event_type AS event
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND occurred_at >= ${from} AND occurred_at < ${to}
        AND event_type = ANY(${[...CONVERSION_EVENTS]})
      GROUP BY event_type
      ORDER BY count(*) DESC, event_type
      LIMIT 1
    `;
    event = row?.event ?? null;
  }

  const pagePattern = q.page ? pathPattern(q.page) : null;
  const [row] = await pgSql<{ sessions: number; bounces: number; conversions: number }[]>`
    WITH s AS (
      SELECT
        session_id,
        count(*) FILTER (WHERE event_type = 'pageview')::int AS pvc,
        (array_agg(coalesce(nullif(page, ''), '/') ORDER BY occurred_at) FILTER (WHERE event_type = 'pageview'))[1] AS entry,
        (array_agg(device ORDER BY occurred_at) FILTER (WHERE event_type = 'pageview'))[1] AS device,
        (array_agg(channel ORDER BY occurred_at) FILTER (WHERE event_type = 'pageview'))[1] AS channel,
        bool_or(${event}::text IS NOT NULL AND event_type = ${event}::text) AS converted
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND occurred_at >= ${from} AND occurred_at < ${to}
        AND session_id IS NOT NULL AND length(trim(session_id)) > 0
      GROUP BY session_id
      HAVING count(*) FILTER (WHERE event_type = 'pageview') >= 1
    )
    SELECT
      count(*)::int AS sessions,
      count(*) FILTER (WHERE pvc = 1)::int AS bounces,
      count(*) FILTER (WHERE converted)::int AS conversions
    FROM s
    WHERE (${pagePattern}::text IS NULL OR s.entry ~ ${pagePattern}::text)
      AND (${q.device ?? null}::text IS NULL OR lower(coalesce(s.device, 'unknown')) = lower(${q.device ?? null}::text))
      AND (${q.channel ?? null}::text IS NULL OR coalesce(s.channel, 'direct') = ${q.channel ?? null}::text)
  `;

  return {
    sessions: row?.sessions ?? 0,
    bounces: row?.bounces ?? 0,
    conversions: event ? (row?.conversions ?? 0) : 0,
    event,
  };
}

/**
 * An anchored regular expression for a stored path or a route pattern: `/orders/:id` matches any one
 * segment where `:id` is, and a trailing slash is optional. Everything else is matched literally.
 */
export function pathPattern(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, "") || "/";
  if (trimmed === "/") return "^/?$";
  const body = trimmed
    .split("/")
    .map((seg) => (seg.startsWith(":") || seg === "*" ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return `^${body}/?$`;
}
