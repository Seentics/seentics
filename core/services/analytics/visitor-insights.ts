import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getVisitorInsightsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const end   = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso    = start.toISOString();
  const endIso      = end.toISOString();
  const lookbackIso = new Date(start.getTime() - 365 * 86400000).toISOString();

  // Single query: materialise current-period rows once in `base`, derive all
  // aggregates from it.  `prev_vids` is the only second scan and is bounded to
  // 365 days before the selected window.
  const rows = await pgSql<{
    top_entry_pages:  { page: string; sessions: number }[] | null;
    top_exit_pages:   { page: string; sessions: number }[] | null;
    avg_dur:          number;
    new_visitors:     number;
    returning_visitors: number;
  }[]>`
    WITH base AS (
      SELECT session_id, page, visitor_id, occurred_at, id
      FROM analytics_events
      WHERE website_id  = ${siteId}
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
    -- Average session duration
    dur_agg AS (
      SELECT round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int AS avg_dur
      FROM (
        SELECT session_id, min(occurred_at) AS mn, max(occurred_at) AS mx
        FROM base
        WHERE session_id IS NOT NULL AND length(trim(session_id)) > 0
        GROUP BY session_id
      ) s
    ),
    -- New vs returning — `prev_vids` lookback is capped at 365 days
    period_vids AS (
      SELECT DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM base
    ),
    prev_vids AS (
      SELECT DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM analytics_events
      WHERE website_id  = ${siteId}
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
      d.avg_dur,
      nr.new_visitors,
      nr.returning_visitors
    FROM entry_agg ea, exit_agg ex, dur_agg d, new_ret nr
  `;

  const row = rows[0];
  return {
    website_id: siteId,
    date_range: `${days}d`,
    visitor_insights: {
      new_visitors:       Number(row?.new_visitors       ?? 0),
      returning_visitors: Number(row?.returning_visitors ?? 0),
      avg_session_duration: Number(row?.avg_dur          ?? 0),
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
