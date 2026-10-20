/**
 * The dashboard's filters (lib/analytics-filters.ts) as SQL over `analytics_events`.
 *
 * Every value is a bound parameter; the only text spliced in is this file's own column
 * expressions. A property key is a parameter too (`properties->>$n`).
 */
import type postgres from "postgres";
import { analyticsReadSql as sql } from "../../../db";
import { hasFilters, type AnalyticsFilters } from "./analytics-filters";
import { pagePathSql, withoutVersionSql } from "./dimension-sql";

/** `%` and `_` taken literally in a LIKE pattern. */
function likePrefix(v: string): string {
  return `${v.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * `AND …` for the filters, to append to a `WHERE` over `analytics_events` (unaliased), or an
 * empty fragment when there are none — so an unfiltered read's SQL is exactly what it was.
 *
 * One fragment of fixed text whatever is set: each predicate is `($n IS NULL OR …)`, and
 * Postgres folds the unset ones away when it plans with the values. `websiteId` and the
 * bounds scope the property filter's session lookup.
 */
export function filterSql(
  f: AnalyticsFilters,
  websiteId: string,
  bounds: { start: string; end: string },
): postgres.Fragment {
  if (!hasFilters(f)) return sql.unsafe("");
  const u = (text: string) => sql.unsafe(text);
  const v = (x: string | undefined) => x ?? null;
  return sql`
    AND (${v(f.country)}::text IS NULL OR upper(country) = ${v(f.country)}::text)
    AND (${v(f.device)}::text IS NULL OR lower(device) = lower(${v(f.device)}::text))
    AND (${v(f.browser)}::text IS NULL
         OR lower(${u(withoutVersionSql("browser"))}) = lower(${v(f.browser)}::text)
         OR lower(browser) LIKE ${f.browser ? likePrefix(f.browser) : null}::text)
    AND (${v(f.os)}::text IS NULL OR lower(${u(withoutVersionSql("os"))}) = lower(${v(f.os)}::text))
    AND (${v(f.utm_source)}::text IS NULL OR lower(trim(utm_source)) = lower(${v(f.utm_source)}::text))
    AND (${v(f.utm_medium)}::text IS NULL OR lower(trim(utm_medium)) = lower(${v(f.utm_medium)}::text))
    AND (${v(f.utm_campaign)}::text IS NULL OR lower(trim(utm_campaign)) = lower(${v(f.utm_campaign)}::text))
    AND (${v(f.page_path)}::text IS NULL OR ${u(pagePathSql("page"))} = ${v(f.page_path)}::text)
    AND (${v(f.prop_key)}::text IS NULL OR session_id IN (
      SELECT p.session_id FROM analytics_events p
      WHERE p.website_id = ${websiteId}
        AND p.occurred_at >= ${bounds.start} AND p.occurred_at < ${bounds.end}
        AND p.properties ? ${v(f.prop_key)}::text
        AND (${v(f.prop_value)}::text IS NULL OR p.properties->>${v(f.prop_key)}::text = ${v(f.prop_value)}::text)
    ))
  `;
}

/**
 * `AND session_id IN (…)`: sessions with a pageview in `bounds` that passes the filters, for
 * reads that measure whole sessions (duration, bounce, entry and exit). Empty when unfiltered.
 */
export function filteredSessionsSql(
  f: AnalyticsFilters,
  websiteId: string,
  bounds: { start: string; end: string },
): postgres.Fragment {
  if (!hasFilters(f)) return sql.unsafe("");
  return sql`
    AND session_id IN (
      SELECT session_id FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${bounds.start} AND occurred_at < ${bounds.end}
        AND session_id IS NOT NULL
        ${filterSql(f, websiteId, bounds)}
    )
  `;
}
