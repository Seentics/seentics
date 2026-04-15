/**
 * Dashboard "Geographic Intelligence" expects `{ countries, cities, ... }` with
 * `name`, `count`, `percentage` (map pins use country centroids on the client when needed).
 */
import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

function iso3166Alpha2ToName(iso2: string): string {
  const c = iso2.trim().toUpperCase();
  if (c.length !== 2 || !/^[A-Z]{2}$/.test(c)) return iso2;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return dn.of(c) ?? iso2;
  } catch {
    return iso2;
  }
}

export async function getGeolocationAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const totalUvRows = await pgSql<{ uv: number }[]>`
    SELECT
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS uv
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
  `;
  const denom = Math.max(0, totalUvRows[0]?.uv ?? 0);

  const countryRows = await pgSql<
    {
      country: string;
      views: number;
      unique_visitors: number;
    }[]
  >`
    SELECT
      country,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND country IS NOT NULL
      AND length(trim(country)) > 0
    GROUP BY country
    ORDER BY unique_visitors DESC
    LIMIT 50
  `;

  const countries = countryRows.map((row) => {
    const code = String(row.country ?? "").trim().toUpperCase();
    const name = code.length === 2 ? iso3166Alpha2ToName(code) : String(row.country ?? "Unknown");
    const count = Number(row.unique_visitors ?? 0);
    const percentage = denom > 0 ? Math.round((count / denom) * 1000) / 10 : 0;
    return { name, code: code.length === 2 ? code : undefined, count, percentage };
  });

  const cityRows = await pgSql<
    {
      city: string;
      country: string;
      views: number;
      unique_visitors: number;
    }[]
  >`
    SELECT
      city,
      country,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND city IS NOT NULL
      AND length(trim(city)) > 0
      AND country IS NOT NULL
      AND length(trim(country)) > 0
    GROUP BY city, country
    ORDER BY unique_visitors DESC
    LIMIT 40
  `;

  const cities = cityRows.map((row) => {
    const count = Number(row.unique_visitors ?? 0);
    const percentage = denom > 0 ? Math.round((count / denom) * 1000) / 10 : 0;
    const cc = String(row.country ?? "").trim().toUpperCase();
    return {
      name: row.city ?? "Unknown",
      code: cc.length === 2 ? cc : undefined,
      count,
      percentage,
    };
  });

  return {
    website_id: siteId,
    date_range: `${days}d`,
    countries,
    cities,
    continents: [] as { name: string; count: number; percentage: number }[],
    regions: [] as { name: string; count: number; percentage: number }[],
  };
}
