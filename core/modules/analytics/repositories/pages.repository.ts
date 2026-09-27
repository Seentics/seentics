import { analyticsReadSql as pgSql } from "../../../db";
import { pagePathSql } from "../lib/dimension-sql";
import { orNotSet, parseDays, windowStartIso } from "./shared";

/**
 * Top pages by pageview count over the trailing window.
 *
 * Takes an already-resolved `websiteId` — resolution is the service's job, done once
 * per request against the websites module rather than repeated here.
 */
export async function getPagesAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);

  const rows = await pgSql<
    {
      page: string;
      views: number;
      unique_visitors: number;
    }[]
  >`
    -- Views and distinct visitors in two hash-aggregation steps: one row per (value,
    -- visitor), then one per value. count(DISTINCT …) always sorts, and over a large
    -- window that sort spilled to disk — 32.8 s for a 90-day top-pages over 633k
    -- pageviews against 3.6 s this way, identical results. count(vk) skips a NULL
    -- visitor key exactly as count(DISTINCT …) did.
    SELECT page, sum(n)::int AS views, count(vk)::int AS unique_visitors
    FROM (
      SELECT
        -- Grouped by path: the stored value is the full href, and grouping it as-is made
        -- /pricing and every /pricing?utm_… separate pages. See lib/dimension-sql.ts.
        ${pgSql.unsafe(pagePathSql("page"))} AS page,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vk,
        count(*) AS n
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${windowStartIso(days)}
        AND page IS NOT NULL
        AND length(trim(page)) > 0
      GROUP BY 1, 2
    ) per_visitor
    GROUP BY page
    ORDER BY views DESC, page ASC
    LIMIT 50
  `;

  return {
    top_pages: rows.map((r) => ({
      page: orNotSet(r.page),
      views: Number(r.views),
      unique: Number(r.unique_visitors),
    })),
  };
}
