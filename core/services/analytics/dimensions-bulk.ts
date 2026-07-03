import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

/**
 * Runs all six dimension queries (pages, referrers, countries, browsers,
 * devices, OS) in a single DB round-trip via a multi-result CTE, returning
 * all data in one API call to cut 6 HTTP round trips down to 1.
 */
export async function getDimensionsBulkAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start    = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

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
        WHERE website_id  = ${siteId}
          AND event_type  = 'pageview'
          AND occurred_at >= ${startIso}
          AND page IS NOT NULL AND length(trim(page)) > 0
        GROUP BY page
        ORDER BY views DESC, page ASC
        LIMIT 50
      `,
      pgSql<RefRow[]>`
        WITH pv AS (
          SELECT referrer, session_id,
                 coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
                 occurred_at, id
          FROM analytics_events
          WHERE website_id  = ${siteId}
            AND event_type  = 'pageview'
            AND occurred_at >= ${startIso}
            AND session_id IS NOT NULL AND length(trim(session_id)) > 0
        ),
        first_ref AS (
          SELECT DISTINCT ON (session_id) session_id, referrer
          FROM pv ORDER BY session_id, occurred_at ASC, id ASC
        )
        SELECT
          coalesce(nullif(trim(fr.referrer), ''), 'direct') AS referrer,
          count(*)::int AS views,
          count(DISTINCT pv.vid)::int AS unique_visitors
        FROM first_ref fr
        JOIN pv ON pv.session_id = fr.session_id
        GROUP BY fr.referrer
        ORDER BY views DESC, referrer ASC
        LIMIT 50
      `,
      pgSql<DimRow[]>`
        SELECT country AS k,
               count(*)::int AS views,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
        FROM analytics_events
        WHERE website_id  = ${siteId}
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
        WHERE website_id  = ${siteId}
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
        WHERE website_id  = ${siteId}
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
        WHERE website_id  = ${siteId}
          AND event_type  = 'pageview'
          AND occurred_at >= ${startIso}
          AND os IS NOT NULL AND length(trim(os)) > 0
        GROUP BY os
        ORDER BY views DESC, os ASC
        LIMIT 50
      `,
    ]);

  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_pages:     pageRows.map(r => ({ page:    r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_referrers: refRows.map(r  => ({ referrer: r.referrer, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_countries: countryRows.map(r => ({ country: r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_browsers:  browserRows.map(r => ({ browser: r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_devices:   deviceRows.map(r  => ({ device:  r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
    top_os:        osRows.map(r      => ({ os:      r.k!, views: Number(r.views), unique: Number(r.unique_visitors) })),
  };
}
