import { analyticsReadSql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

export async function getLanguagesAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);

  const rows = await pgSql<{ language: string; views: number; unique: number }[]>`
    -- Views and distinct visitors in two hash-aggregation steps: one row per (value,
    -- visitor), then one per value. count(DISTINCT …) always sorts, and over a large
    -- window that sort spilled to disk — 32.8 s for a 90-day top-pages over 633k
    -- pageviews against 3.6 s this way, identical results. count(vk) skips a NULL
    -- visitor key exactly as count(DISTINCT …) did.
    SELECT language, sum(n)::int AS views, count(vk)::int AS unique
    FROM (
      SELECT
        language,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vk,
        count(*) AS n
      FROM analytics_events
      WHERE website_id  = ${websiteId}
        AND event_type  = 'pageview'
        AND occurred_at >= ${startIso}
        AND language IS NOT NULL
        AND length(trim(language)) > 0
      GROUP BY 1, 2
    ) per_visitor
    GROUP BY language
    ORDER BY views DESC, language ASC
    LIMIT 30
  `;

  return {
    website_id: websiteId,
    top_languages: rows.map((r) => ({ language: r.language, views: r.views, unique: r.unique })),
  };
}
