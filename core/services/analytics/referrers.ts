import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getReferrersAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{
    referrer: string | null;
    views: number;
    unique_visitors: number;
  }[]>`
    WITH pv AS (
      SELECT
        id,
        referrer,
        session_id,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
        occurred_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    -- First referrer per session (deterministic via id tiebreaker)
    first_ref AS (
      SELECT DISTINCT ON (session_id) session_id, referrer
      FROM pv ORDER BY session_id, occurred_at ASC, id ASC
    )
    SELECT
      coalesce(nullif(trim(fr.referrer), ''), 'direct') AS referrer,
      count(*)::int AS views,
      count(DISTINCT pv.vid)::int AS unique_visitors
    FROM first_ref fr
    JOIN pv ON pv.session_id = fr.session_id
    GROUP BY fr.referrer
    ORDER BY views DESC
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
