import { analyticsReadSql as pgSql } from "../../../db";
import { pagePathSql, withoutVersionSql } from "../lib/dimension-sql";
import { parseDays, windowStartIso } from "./shared";
import { sessionReferrerRows } from "./referrers.repository";
import { rollupsEnabled, topRows } from "../rollups/reads";

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

  // From the rollups when available: six small lookups instead of six scans.
  if (rollupsEnabled()) {
    const [pages, referrers, countries, browsers, devices, os] = await Promise.all([
      topRows(websiteId, "page", days, 50),
      sessionReferrerRows(websiteId, days),
      topRows(websiteId, "country", days, 50),
      topRows(websiteId, "browser", days, 50),
      topRows(websiteId, "device", days, 50),
      topRows(websiteId, "os", days, 50),
    ]);
    return {
      website_id: websiteId,
      date_range: `${days}d`,
      top_pages:     pages.map(r => ({ page: r.k, views: r.views, unique: r.unique_visitors })),
      top_referrers: referrers.map(r => ({ referrer: r.referrer, views: Number(r.views), unique: Number(r.unique_visitors) })),
      top_countries: countries.map(r => ({ country: r.k, views: r.views, unique: r.unique_visitors })),
      top_browsers:  browsers.map(r => ({ browser: r.k, views: r.views, unique: r.unique_visitors })),
      top_devices:   devices.map(r => ({ device: r.k, views: r.views, unique: r.unique_visitors })),
      top_os:        os.map(r => ({ os: r.k, views: r.views, unique: r.unique_visitors })),
    };
  }

  // Referrers use session-based deduplication (first referrer per session).
  // Everything else is a simple GROUP BY.
  // The five plain dimensions count views and distinct visitors in two hash-aggregation
  // steps — one row per (value, visitor), then one per value — instead of
  // count(DISTINCT …), which always sorts and spilled to disk on large windows (see
  // pages.repository.ts for the measurements). Same results; count(vk) skips a NULL
  // visitor key as count(DISTINCT …) did. Pages group by path and browsers/OSes by name,
  // exactly as their standalone endpoints do — see lib/dimension-sql.ts.
  const [pageRows, refRows, countryRows, browserRows, deviceRows, osRows] =
    await Promise.all([
      pgSql<DimRow[]>`
        SELECT k, sum(n)::int AS views, count(vk)::int AS unique_visitors
        FROM (
          SELECT ${pgSql.unsafe(pagePathSql("page"))} AS k, coalesce(nullif(trim(visitor_id), ''), session_id) AS vk, count(*) AS n
          FROM analytics_events
          WHERE website_id  = ${websiteId}
            AND event_type  = 'pageview'
            AND occurred_at >= ${startIso}
            AND page IS NOT NULL AND length(trim(page)) > 0
          GROUP BY 1, 2
        ) per_visitor
        GROUP BY k
        ORDER BY views DESC, k ASC
        LIMIT 50
      `,
      // Kept in step with referrers.repository.ts, which carries the full note: the
      // normalisation belongs inside the window, or NULL, empty and whitespace referrers
      // become three separate groups that all render as 'direct'.
      sessionReferrerRows(websiteId, days),
      pgSql<DimRow[]>`
        SELECT k, sum(n)::int AS views, count(vk)::int AS unique_visitors
        FROM (
          SELECT country AS k, coalesce(nullif(trim(visitor_id), ''), session_id) AS vk, count(*) AS n
          FROM analytics_events
          WHERE website_id  = ${websiteId}
            AND event_type  = 'pageview'
            AND occurred_at >= ${startIso}
            AND country IS NOT NULL AND length(trim(country)) > 0
          GROUP BY 1, 2
        ) per_visitor
        GROUP BY k
        ORDER BY views DESC, k ASC
        LIMIT 50
      `,
      pgSql<DimRow[]>`
        SELECT k, sum(n)::int AS views, count(vk)::int AS unique_visitors
        FROM (
          SELECT ${pgSql.unsafe(withoutVersionSql("browser"))} AS k, coalesce(nullif(trim(visitor_id), ''), session_id) AS vk, count(*) AS n
          FROM analytics_events
          WHERE website_id  = ${websiteId}
            AND event_type  = 'pageview'
            AND occurred_at >= ${startIso}
            AND browser IS NOT NULL AND length(trim(browser)) > 0
          GROUP BY 1, 2
        ) per_visitor
        GROUP BY k
        ORDER BY views DESC, k ASC
        LIMIT 50
      `,
      pgSql<DimRow[]>`
        SELECT k, sum(n)::int AS views, count(vk)::int AS unique_visitors
        FROM (
          SELECT device AS k, coalesce(nullif(trim(visitor_id), ''), session_id) AS vk, count(*) AS n
          FROM analytics_events
          WHERE website_id  = ${websiteId}
            AND event_type  = 'pageview'
            AND occurred_at >= ${startIso}
            AND device IS NOT NULL AND length(trim(device)) > 0
          GROUP BY 1, 2
        ) per_visitor
        GROUP BY k
        ORDER BY views DESC, k ASC
        LIMIT 50
      `,
      pgSql<DimRow[]>`
        SELECT k, sum(n)::int AS views, count(vk)::int AS unique_visitors
        FROM (
          SELECT ${pgSql.unsafe(withoutVersionSql("os"))} AS k, coalesce(nullif(trim(visitor_id), ''), session_id) AS vk, count(*) AS n
          FROM analytics_events
          WHERE website_id  = ${websiteId}
            AND event_type  = 'pageview'
            AND occurred_at >= ${startIso}
            AND os IS NOT NULL AND length(trim(os)) > 0
          GROUP BY 1, 2
        ) per_visitor
        GROUP BY k
        ORDER BY views DESC, k ASC
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
