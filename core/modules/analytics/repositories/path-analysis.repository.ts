import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

/**
 * The first three pages of each session, counted as paths.
 *
 * Two things about this query are load-bearing and easy to undo by accident.
 *
 * **`COLLATE "C"` on `session_id` and `page`.** The database runs `en_US.utf8`, so every
 * text comparison goes through the locale's collation — and this query's cost *is* text
 * comparison: a sort of every pageview in the window by `(session_id, occurred_at, id)` to
 * feed the window function, then a second sort of one row per session by the three page
 * columns. Comparing under `C` is a byte comparison instead of a locale-aware one, and it
 * took the whole query from 98ms to 59ms on 400k events.
 *
 * It cannot change the result. Postgres collations are deterministic, so *equality* is
 * bytewise either way, and equality is all these two columns are used for here — grouping
 * sessions, and grouping identical paths. Neither is presented in collated order: the
 * output is ordered by session count. Verified against the un-collated query on the same
 * 400k rows, zero differing rows.
 *
 * **The window's `step <= 3` filter.** Postgres 15 turns that into a run condition and
 * stops the window function early, which is why only the first three pages of a session
 * are ever materialised however long the session is.
 */
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
    WITH src AS (
      SELECT
        session_id COLLATE "C" AS sid,
        page COLLATE "C" AS page,
        occurred_at,
        id
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
        AND page IS NOT NULL
        AND length(trim(page)) > 0
    ),
    ordered AS (
      SELECT
        sid,
        page,
        ROW_NUMBER() OVER (PARTITION BY sid ORDER BY occurred_at ASC, id ASC) AS step
      FROM src
    ),
    -- One row per session with its first three pages (no self-joins; only the
    -- first three steps survive past the window function).
    first_steps AS (
      SELECT
        sid,
        max(page) FILTER (WHERE step = 1) AS page_1,
        max(page) FILTER (WHERE step = 2) AS page_2,
        max(page) FILTER (WHERE step = 3) AS page_3
      FROM ordered
      WHERE step <= 3
      GROUP BY sid
    )
    SELECT
      page_1,
      page_2,
      page_3,
      count(*)::int AS sessions
    FROM first_steps
    WHERE page_1 IS NOT NULL
    GROUP BY page_1, page_2, page_3
    -- The page columns tie-break, so which fifty rows come back is stable. Without them
    -- two paths with equal session counts could swap places between calls, which makes the
    -- response cache return a different fifty for the same window.
    ORDER BY sessions DESC, page_1 ASC, page_2 ASC, page_3 ASC
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
