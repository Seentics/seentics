import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getPathAnalysisAnalytics(
  websiteParam: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 7);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const paths = await pgSql<{
    page_1: string;
    page_2: string | null;
    page_3: string | null;
    sessions: number;
  }[]>`
    WITH ordered AS (
      SELECT
        session_id,
        page,
        ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY occurred_at ASC, id ASC) AS step
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
        AND page IS NOT NULL
        AND length(trim(page)) > 0
    )
    SELECT
      p1.page AS page_1,
      p2.page AS page_2,
      p3.page AS page_3,
      count(DISTINCT p1.session_id)::int AS sessions
    FROM ordered p1
    LEFT JOIN ordered p2 ON p2.session_id = p1.session_id AND p2.step = 2
    LEFT JOIN ordered p3 ON p3.session_id = p1.session_id AND p3.step = 3
    WHERE p1.step = 1
    GROUP BY p1.page, p2.page, p3.page
    ORDER BY sessions DESC
    LIMIT 50
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    paths: paths.map((r) => ({
      page_1: r.page_1,
      page_2: r.page_2 ?? null,
      page_3: r.page_3 ?? null,
      sessions: Number(r.sessions),
    })),
  };
}
