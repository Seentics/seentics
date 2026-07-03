import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

async function topDimensionAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
  col: "country" | "browser" | "device" | "os",
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

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
    WHERE website_id = ${siteId}
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

export const getCountriesAnalytics = (w: string, q: Record<string, string | undefined>) =>
  topDimensionAnalytics(w, q, "country");
export const getBrowsersAnalytics = (w: string, q: Record<string, string | undefined>) =>
  topDimensionAnalytics(w, q, "browser");
export const getDevicesAnalytics = (w: string, q: Record<string, string | undefined>) =>
  topDimensionAnalytics(w, q, "device");
export const getOsAnalytics = (w: string, q: Record<string, string | undefined>) =>
  topDimensionAnalytics(w, q, "os");
