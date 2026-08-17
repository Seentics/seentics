import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

export async function getLanguagesAnalytics(
  siteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);

  const rows = await pgSql<{ language: string; views: number; unique: number }[]>`
    SELECT
      language,
      count(*)::int                                                                       AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int             AS unique
    FROM analytics_events
    WHERE website_id  = ${siteId}
      AND event_type  = 'pageview'
      AND occurred_at >= ${startIso}
      AND language IS NOT NULL
      AND length(trim(language)) > 0
    GROUP BY language
    ORDER BY views DESC, language ASC
    LIMIT 30
  `;

  return {
    website_id: siteId,
    top_languages: rows.map((r) => ({ language: r.language, views: r.views, unique: r.unique })),
  };
}
