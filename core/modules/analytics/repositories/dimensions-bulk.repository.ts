import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

/**
 * All six dimension breakdowns (pages, referrers, countries, browsers, devices, OS) behind
 * one request, so a dashboard view needing more than two of them makes one HTTP round trip
 * instead of six.
 *
 * Six database queries, though — not one, whatever an earlier version of this comment
 * claimed. They are deliberately left separate: each one matches a partial covering index
 * built for its exact shape (`ix_analytics_pageview_page`, `…_country`, `…_browser`,
 * `…_device`, `…_os`, `…_session_ref`), all of them `(website_id, <dimension>,
 * occurred_at)` and partial on `event_type = 'pageview'` with that dimension present.
 * Folding them into one scan with `GROUPING SETS` would read every pageview row in the
 * window through the heap and sort it five ways, which is slower than five index-backed
 * scans for any window a dashboard actually asks for.
 *
 * `Promise.all`, so the six overlap on the pool rather than running end to end.
 */
export async function getDimensionsBulkAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);

  type DimRow  = { k: string | null; views: number; unique_visitors: number };
  type RefRow  = { referrer: string; views: number; unique_visitors: number };

  // Referrers use session-based deduplication (first referrer per session).
  // Everything else is a simple GROUP BY.
  const [pageRows, refRows, countryRows, browserRows, deviceRows, osRows] =
    await Promise.all([
      pgSql<DimRow[]>`
        SELECT page AS k,
               count(*)::int AS views,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
        FROM analytics_events
        WHERE website_id  = ${websiteId}
          AND event_type  = 'pageview'
          AND occurred_at >= ${startIso}
          AND page IS NOT NULL AND length(trim(page)) > 0
        GROUP BY page
        ORDER BY views DESC, page ASC
        LIMIT 50
      `,
      // Kept in step with referrers.repository.ts, which carries the full note: the
      // normalisation belongs inside the window, or NULL, empty and whitespace referrers
      // become three separate groups that all render as 'direct'.
      pgSql<RefRow[]>`
        WITH pv AS (
          SELECT
            coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
            first_value(coalesce(nullif(trim(referrer), ''), 'direct'))
              OVER (PARTITION BY session_id ORDER BY occurred_at ASC, id ASC) AS first_ref
          FROM analytics_events
          WHERE website_id  = ${websiteId}
            AND event_type  = 'pageview'
            AND occurred_at >= ${startIso}
            AND session_id IS NOT NULL AND length(trim(session_id)) > 0
        )
        SELECT
          first_ref AS referrer,
          count(*)::int AS views,
          count(DISTINCT vid)::int AS unique_visitors
        FROM pv
        GROUP BY first_ref
        ORDER BY views DESC, referrer ASC
        LIMIT 50
      `,
      pgSql<DimRow[]>`
        SELECT country AS k,
               count(*)::int AS views,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
        FROM analytics_events
        WHERE website_id  = ${websiteId}
          AND event_type  = 'pageview'
          AND occurred_at >= ${startIso}
          AND country IS NOT NULL AND length(trim(country)) > 0
        GROUP BY country
        ORDER BY views DESC, country ASC
        LIMIT 50
      `,
      pgSql<DimRow[]>`
        SELECT browser AS k,
               count(*)::int AS views,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
        FROM analytics_events
        WHERE website_id  = ${websiteId}
          AND event_type  = 'pageview'
          AND occurred_at >= ${startIso}
          AND browser IS NOT NULL AND length(trim(browser)) > 0
        GROUP BY browser
        ORDER BY views DESC, browser ASC
        LIMIT 50
      `,
      pgSql<DimRow[]>`
        SELECT device AS k,
               count(*)::int AS views,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
        FROM analytics_events
        WHERE website_id  = ${websiteId}
          AND event_type  = 'pageview'
          AND occurred_at >= ${startIso}
          AND device IS NOT NULL AND length(trim(device)) > 0
        GROUP BY device
        ORDER BY views DESC, device ASC
        LIMIT 50
      `,
      pgSql<DimRow[]>`
        SELECT os AS k,
               count(*)::int AS views,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
        FROM analytics_events
        WHERE website_id  = ${websiteId}
          AND event_type  = 'pageview'
          AND occurred_at >= ${startIso}
          AND os IS NOT NULL AND length(trim(os)) > 0
        GROUP BY os
        ORDER BY views DESC, os ASC
        LIMIT 50
      `,
    ]);

  return {
    website_id: websiteId,
    date_range: `${days}d`,
    top_pages:     pageRows.map(r => ({ page:    r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_referrers: refRows.map(r  => ({ referrer: r.referrer, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_countries: countryRows.map(r => ({ country: r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_browsers:  browserRows.map(r => ({ browser: r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_devices:   deviceRows.map(r  => ({ device:  r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_os:        osRows.map(r      => ({ os:      r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
  };
}
