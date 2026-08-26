import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

export async function getPathAnalysisAnalytics(
  websiteId: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 7);
  const startIso = windowStartIso(days);

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
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
        AND page IS NOT NULL
        AND length(trim(page)) > 0
    ),
    -- One row per session with its first three pages (no self-joins; only the
    -- first three steps survive past the window function).
    first_steps AS (
      SELECT
        session_id,
        max(page) FILTER (WHERE step = 1) AS page_1,
        max(page) FILTER (WHERE step = 2) AS page_2,
        max(page) FILTER (WHERE step = 3) AS page_3
      FROM ordered
      WHERE step <= 3
      GROUP BY session_id
    )
    SELECT
      page_1,
      page_2,
      page_3,
      count(*)::int AS sessions
    FROM first_steps
    WHERE page_1 IS NOT NULL
    GROUP BY page_1, page_2, page_3
    ORDER BY sessions DESC
    LIMIT 50
  `;

  return {
    website_id: websiteId,
    date_range: `${days}d`,
    paths: paths.map((r) => ({
      page_1: r.page_1,
      page_2: r.page_2 ?? null,
      page_3: r.page_3 ?? null,
      sessions: Number(r.sessions),
    })),
  };
}
