import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getSourcesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{ source: string; views: number; unique_visitors: number; bounce_rate: number }[]>`
    WITH pv AS (
      SELECT
        id,
        utm_source,
        session_id,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
        occurred_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND utm_source IS NOT NULL
        AND length(trim(utm_source)) > 0
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    first_src AS (
      -- id as tiebreaker so result is deterministic when two pageviews share the same timestamp
      SELECT DISTINCT ON (session_id) session_id, utm_source
      FROM pv ORDER BY session_id, occurred_at ASC, id ASC
    ),
    session_pvc AS (
      SELECT session_id, count(*)::int AS pvc
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
      GROUP BY session_id
    )
    SELECT
      fs.utm_source AS source,
      count(*)::int AS views,
      count(DISTINCT pv.vid)::int AS unique_visitors,
      CASE
        WHEN count(DISTINCT fs.session_id) = 0 THEN 0::float
        ELSE round(
          (
            sum(CASE WHEN spc.pvc = 1 THEN 1 ELSE 0 END)::float
            / count(DISTINCT fs.session_id)::float * 100
          )::numeric,
          1
        )
      END AS bounce_rate
    FROM first_src fs
    JOIN session_pvc spc ON spc.session_id = fs.session_id
    JOIN pv ON pv.session_id = fs.session_id
    GROUP BY fs.utm_source
    ORDER BY views DESC
    LIMIT 50
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_sources: rows.map((r) => ({
      source: r.source,
      views: Number(r.views),
      unique: Number(r.unique_visitors),
      bounce_rate: Number(r.bounce_rate),
    })),
  };
}
