import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

export async function getReferrersAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);

  const rows = await pgSql<{
    referrer: string | null;
    views: number;
    unique_visitors: number;
  }[]>`
    WITH pv AS (
      SELECT
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
        -- The session's first referrer, normalised here rather than in the outer SELECT.
        -- That placement is the fix: grouping on the raw column put NULL, '' and '   ' in
        -- three separate groups that all rendered as 'direct', so the dashboard showed
        -- several "direct" rows, each holding part of the real total — and each consuming
        -- one of the fifty slots below.
        first_value(coalesce(nullif(trim(referrer), ''), 'direct'))
          OVER (PARTITION BY session_id ORDER BY occurred_at ASC, id ASC) AS first_ref
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    )
    -- One pass. The previous shape referenced pv twice — once to pick the first referrer
    -- per session, once to join it back to every pageview of that session — which made
    -- Postgres materialise the CTE and sort it twice. first_value labels every row with
    -- its session's first referrer in the same window, so the join disappears. It measured
    -- no faster (the sort by session is the cost either way), but it is a smaller query
    -- with one fewer place for the grouping to go wrong.
    SELECT
      first_ref AS referrer,
      count(*)::int AS views,
      count(DISTINCT vid)::int AS unique_visitors
    FROM pv
    GROUP BY first_ref
    ORDER BY views DESC, referrer ASC
    LIMIT 50
  `;

  return {
    top_referrers: rows.map((r) => ({
      referrer: r.referrer ?? "direct",
      views: Number(r.views),
      unique: Number(r.unique_visitors),
    })),
  };
}
