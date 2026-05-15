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
    bounce_rate: number;
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
    first_ref AS (
      -- id as tiebreaker so result is deterministic when two pageviews share the same timestamp
      SELECT DISTINCT ON (session_id) session_id, referrer
      FROM pv ORDER BY session_id, occurred_at ASC, id ASC
    ),
    session_pvc AS (
      SELECT session_id, count(*)::int AS pvc
      FROM pv GROUP BY session_id
    )
    SELECT
      coalesce(nullif(trim(fr.referrer), ''), 'direct') AS referrer,
      count(*)::int AS views,
      count(DISTINCT pv.vid)::int AS unique_visitors,
      CASE
        WHEN count(DISTINCT fr.session_id) = 0 THEN 0::float
        ELSE round(
          (
            sum(CASE WHEN spc.pvc = 1 THEN 1 ELSE 0 END)::float
            / count(DISTINCT fr.session_id)::float * 100
          )::numeric,
          1
        )
      END AS bounce_rate
    FROM first_ref fr
    JOIN session_pvc spc ON spc.session_id = fr.session_id
    JOIN pv ON pv.session_id = fr.session_id
    GROUP BY fr.referrer
    ORDER BY views DESC
    LIMIT 50
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_referrers: rows.map((r) => ({
      referrer: r.referrer ?? "direct",
      views: Number(r.views),
      unique: Number(r.unique_visitors),
      bounce_rate: Number(r.bounce_rate),
    })),
  };
}
