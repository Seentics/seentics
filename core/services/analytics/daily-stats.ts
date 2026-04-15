import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getDailyStatsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days, 30);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{
    date: string;
    views: number;
    unique_visitors: number;
    avg_session_duration: number;
    bounce_rate: number;
  }[]>`
    WITH pv AS (
      SELECT
        date_trunc('day', occurred_at AT TIME ZONE 'UTC')::date::text AS day,
        event_type,
        session_id,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
        occurred_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    pageviews AS (
      SELECT day, count(*) AS views, count(DISTINCT vid) AS uniq
      FROM pv WHERE event_type = 'pageview'
      GROUP BY day
    ),
    sess AS (
      SELECT
        day,
        session_id,
        count(*) FILTER (WHERE event_type = 'pageview')::int AS pvc,
        min(occurred_at) AS mn,
        max(occurred_at) AS mx
      FROM pv GROUP BY day, session_id
    ),
    sess_agg AS (
      SELECT
        day,
        round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int AS avg_dur,
        CASE
          WHEN count(*) FILTER (WHERE pvc >= 1) = 0 THEN 0::float
          ELSE (count(*) FILTER (WHERE pvc = 1))::float * 100.0
               / (count(*) FILTER (WHERE pvc >= 1))::float
        END AS bounce_rate
      FROM sess GROUP BY day
    )
    SELECT
      pv.day AS date,
      coalesce(pv.views, 0)::int AS views,
      coalesce(pv.uniq, 0)::int AS unique_visitors,
      coalesce(sa.avg_dur, 0)::int AS avg_session_duration,
      coalesce(sa.bounce_rate, 0)::float AS bounce_rate
    FROM pageviews pv
    LEFT JOIN sess_agg sa ON sa.day = pv.day
    ORDER BY pv.day ASC
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    daily_stats: rows.map((x) => ({
      date: x.date,
      views: Number(x.views),
      unique: Number(x.unique_visitors),
      bounce_rate: Math.round(Number(x.bounce_rate) * 10) / 10,
      avg_session_duration: Number(x.avg_session_duration),
    })),
  };
}
