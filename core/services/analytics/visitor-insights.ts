import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getVisitorInsightsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const entrySql = pgSql<{ page: string; sessions: number }[]>`
    WITH pv AS (
      SELECT
        session_id,
        page,
        ROW_NUMBER() OVER (
          PARTITION BY session_id
          ORDER BY occurred_at ASC, id ASC
        ) AS rn
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
        AND page IS NOT NULL
        AND length(trim(page)) > 0
    )
    SELECT page, count(*)::int AS sessions
    FROM pv
    WHERE rn = 1
    GROUP BY page
    ORDER BY count(*) DESC
    LIMIT 30
  `;

  const exitSql = pgSql<{ page: string; sessions: number }[]>`
    WITH pv AS (
      SELECT
        session_id,
        page,
        ROW_NUMBER() OVER (
          PARTITION BY session_id
          ORDER BY occurred_at DESC, id DESC
        ) AS rn
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
        AND page IS NOT NULL
        AND length(trim(page)) > 0
    )
    SELECT page, count(*)::int AS sessions
    FROM pv
    WHERE rn = 1
    GROUP BY page
    ORDER BY count(*) DESC
    LIMIT 30
  `;

  const newReturningSql = pgSql<{ new_visitors: number; returning_visitors: number }[]>`
    WITH period_vids AS (
      SELECT DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
    ),
    prev_vids AS (
      -- Cap the lookback at 365 days — scanning unbounded history is a full table scan.
      -- Visitors unseen in 12 months are treated as new, which is correct UX-wise too.
      SELECT DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${new Date(start.getTime() - 365 * 86400000).toISOString()}
        AND occurred_at < ${startIso}
    )
    SELECT
      count(CASE WHEN prev.vid IS NULL     THEN 1 END)::int AS new_visitors,
      count(CASE WHEN prev.vid IS NOT NULL THEN 1 END)::int AS returning_visitors
    FROM period_vids cur
    LEFT JOIN prev_vids prev ON prev.vid = cur.vid
  `;

  const avgDurSql = pgSql<{ avg_dur: number }[]>`
    SELECT round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int AS avg_dur
    FROM (
      SELECT session_id, min(occurred_at) AS mn, max(occurred_at) AS mx
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
      GROUP BY session_id
    ) s
  `;

  const [topEntryPages, topExitPages, newReturning, avgDurRows] = await Promise.all([
    entrySql,
    exitSql,
    newReturningSql,
    avgDurSql,
  ]);

  return {
    website_id: siteId,
    date_range: `${days}d`,
    visitor_insights: {
      new_visitors: Number(newReturning[0]?.new_visitors ?? 0),
      returning_visitors: Number(newReturning[0]?.returning_visitors ?? 0),
      avg_session_duration: Number(avgDurRows[0]?.avg_dur ?? 0),
      top_entry_pages: topEntryPages.map((r) => ({
        page: r.page,
        sessions: Number(r.sessions ?? 0),
      })),
      top_exit_pages: topExitPages.map((r) => ({
        page: r.page,
        sessions: Number(r.sessions ?? 0),
      })),
    },
  };
}
