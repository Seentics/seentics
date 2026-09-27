import { analyticsReadSql as pgSql } from "../../../db";
import { withoutVersionSql } from "../lib/dimension-sql";
import { parseDays, windowStartIso } from "./shared";

async function topDimensionAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
  col: "country" | "browser" | "device" | "os",
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);

  // pgSql([colName]) = postgres.js identifier escaping — safe for this trusted union type
  const colIdent = pgSql([col]);
  // Browsers and operating systems are grouped by name, not version — Chrome 127 and
  // Chrome 128 are one browser. See lib/dimension-sql.ts.
  const valueExpr = col === "browser" || col === "os" ? pgSql.unsafe(withoutVersionSql(col)) : colIdent;

  const rows = await pgSql<{
    k: string | null;
    views: number;
    unique_visitors: number;
  }[]>`
    -- Views and distinct visitors in two hash-aggregation steps: one row per (value,
    -- visitor), then one per value. count(DISTINCT …) always sorts, and over a large
    -- window that sort spilled to disk — 32.8 s for a 90-day top-pages over 633k
    -- pageviews against 3.6 s this way, identical results. count(vk) skips a NULL
    -- visitor key exactly as count(DISTINCT …) did.
    SELECT k, sum(n)::int AS views, count(vk)::int AS unique_visitors
    FROM (
      SELECT
        ${valueExpr} AS k,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vk,
        count(*) AS n
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND ${colIdent} IS NOT NULL
        AND length(trim(${colIdent})) > 0
      GROUP BY 1, 2
    ) per_visitor
    GROUP BY k
    ORDER BY views DESC, k ASC
    LIMIT 50
  `;

  const key =
    col === "country"
      ? "top_countries"
      : col === "browser"
        ? "top_browsers"
        : col === "device"
          ? "top_devices"
          : "top_os";
  return {
    [key]: rows.map((r) => ({
      [col]: r.k!,
      views: Number(r.views),
      unique: Number(r.unique_visitors),
    })),
  };
}

export const getCountriesAnalytics = (websiteId: string, q: Record<string, string | undefined>) =>
  topDimensionAnalytics(websiteId, q, "country");
export const getBrowsersAnalytics = (websiteId: string, q: Record<string, string | undefined>) =>
  topDimensionAnalytics(websiteId, q, "browser");
export const getDevicesAnalytics = (websiteId: string, q: Record<string, string | undefined>) =>
  topDimensionAnalytics(websiteId, q, "device");
export const getOsAnalytics = (websiteId: string, q: Record<string, string | undefined>) =>
  topDimensionAnalytics(websiteId, q, "os");
