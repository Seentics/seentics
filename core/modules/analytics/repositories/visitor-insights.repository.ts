import { analyticsReadSql as pgSql } from "../../../db";
import { pagePathSql } from "../lib/dimension-sql";
import { parseDays } from "./shared";
import { newVisitorCount, rollupsEnabled, siteUniques, topRows } from "../rollups/reads";

/**
 * The raw query's single row, from the rollups. New visitors are those first seen
 * inside the window; returning is everyone else in it — so the two always add up to the
 * window's unique visitors (itself a HyperLogLog estimate on large sites).
 */
async function insightsFromRollups(websiteId: string, days: number) {
  const [entry, exit, newVisitors, uv] = await Promise.all([
    topRows(websiteId, "entry_page", days, 30, "sessions"),
    topRows(websiteId, "exit_page", days, 30, "sessions"),
    newVisitorCount(websiteId, days),
    siteUniques(websiteId, days),
  ]);
  const clampedNew = Math.min(newVisitors, uv);
  return {
    top_entry_pages: entry.map((r) => ({ page: r.k, sessions: r.sessions })),
    top_exit_pages: exit.map((r) => ({ page: r.k, sessions: r.sessions })),
    new_visitors: clampedNew,
    returning_visitors: uv - clampedNew,
  };
}

export async function getVisitorInsightsAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const end   = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso    = start.toISOString();
  const endIso      = end.toISOString();
  const lookbackIso = new Date(start.getTime() - 365 * 86400000).toISOString();

  // Single query: materialise current-period rows once in `base`, derive all
  // aggregates from it. prev_vids lookback is capped at 365 days.
  const rows = rollupsEnabled() ? [await insightsFromRollups(websiteId, days)] : await pgSql<{
    top_entry_pages:    { page: string; sessions: number }[] | null;
    top_exit_pages:     { page: string; sessions: number }[] | null;
    new_visitors:       number;
    returning_visitors: number;
  }[]>`
    WITH base AS (
      -- Entry and exit pages by path, like top-pages (see lib/dimension-sql.ts).
      SELECT session_id, ${pgSql.unsafe(pagePathSql("page"))} AS page, visitor_id, occurred_at, id
      FROM analytics_events
      WHERE website_id  = ${websiteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
    ),
    -- Entry: first page per session using DISTINCT ON (cheaper than ROW_NUMBER)
    entry_raw AS (
      SELECT DISTINCT ON (session_id) session_id, page
      FROM base
      WHERE session_id IS NOT NULL AND length(trim(session_id)) > 0
        AND page        IS NOT NULL AND length(trim(page))       > 0
      ORDER BY session_id, occurred_at ASC, id ASC
    ),
    entry_agg AS (
      SELECT json_agg(t ORDER BY t.sessions DESC) AS data
      FROM (
        SELECT page, COUNT(*)::int AS sessions
        FROM entry_raw
        GROUP BY page
        ORDER BY sessions DESC
        LIMIT 30
      ) t
    ),
    -- Exit: last page per session
    exit_raw AS (
      SELECT DISTINCT ON (session_id) session_id, page
      FROM base
      WHERE session_id IS NOT NULL AND length(trim(session_id)) > 0
        AND page        IS NOT NULL AND length(trim(page))       > 0
      ORDER BY session_id, occurred_at DESC, id DESC
    ),
    exit_agg AS (
      SELECT json_agg(t ORDER BY t.sessions DESC) AS data
      FROM (
        SELECT page, COUNT(*)::int AS sessions
        FROM exit_raw
        GROUP BY page
        ORDER BY sessions DESC
        LIMIT 30
      ) t
    ),
    -- New vs returning: prev_vids lookback is capped at 365 days
    period_vids AS (
      SELECT DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM base
    ),
    prev_vids AS (
      SELECT DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM analytics_events
      WHERE website_id  = ${websiteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${lookbackIso}
        AND occurred_at <  ${startIso}
    ),
    new_ret AS (
      SELECT
        COUNT(CASE WHEN prev.vid IS NULL     THEN 1 END)::int AS new_visitors,
        COUNT(CASE WHEN prev.vid IS NOT NULL THEN 1 END)::int AS returning_visitors
      FROM period_vids cur
      LEFT JOIN prev_vids prev ON prev.vid = cur.vid
    )
    SELECT
      ea.data  AS top_entry_pages,
      ex.data  AS top_exit_pages,
      nr.new_visitors,
      nr.returning_visitors
    FROM entry_agg ea, exit_agg ex, new_ret nr
  `;

  const row = rows[0];
  return {
    website_id: websiteId,
    date_range: `${days}d`,
    visitor_insights: {
      new_visitors:       Number(row?.new_visitors       ?? 0),
      returning_visitors: Number(row?.returning_visitors ?? 0),
      top_entry_pages: (row?.top_entry_pages ?? []).map((r) => ({
        page:     r.page,
        sessions: Number(r.sessions ?? 0),
      })),
      top_exit_pages: (row?.top_exit_pages ?? []).map((r) => ({
        page:     r.page,
        sessions: Number(r.sessions ?? 0),
      })),
    },
  };
}
