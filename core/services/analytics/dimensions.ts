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
    bounce_rate: number;
  }[]>`
    WITH pv AS (
      SELECT
        ${colIdent} AS dim,
        session_id,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    session_pvc AS (
      -- Reuse the pv CTE instead of re-scanning analytics_events a second time.
      SELECT session_id, count(*)::int AS pvc
      FROM pv GROUP BY session_id
    )
    SELECT
      pv.dim AS k,
      count(*)::int AS views,
      count(DISTINCT pv.vid)::int AS unique_visitors,
      CASE
        WHEN count(DISTINCT pv.session_id) = 0 THEN 0::float
        ELSE round(
          (
            sum(CASE WHEN spc.pvc = 1 THEN 1 ELSE 0 END)::float
            / count(DISTINCT pv.session_id)::float * 100
          )::numeric,
          1
        )
      END AS bounce_rate
    FROM pv
    JOIN session_pvc spc ON spc.session_id = pv.session_id
    WHERE pv.dim IS NOT NULL AND length(trim(pv.dim)) > 0
    GROUP BY pv.dim
    ORDER BY views DESC
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
    website_id: siteId,
    date_range: `${days}d`,
    [key]: rows.map((r) => ({
      [col]: r.k!,
      views: Number(r.views),
      unique: Number(r.unique_visitors),
      bounce_rate: Number(r.bounce_rate ?? 0),
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
