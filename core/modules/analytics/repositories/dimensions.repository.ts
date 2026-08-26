import { sql as pgSql } from "../../../db";
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

  const rows = await pgSql<{
    k: string | null;
    views: number;
    unique_visitors: number;
  }[]>`
    SELECT
      ${colIdent} AS k,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${websiteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND ${colIdent} IS NOT NULL
      AND length(trim(${colIdent})) > 0
    GROUP BY ${colIdent}
    ORDER BY views DESC, ${colIdent} ASC
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
