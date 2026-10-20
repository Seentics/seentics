/**
 * Dashboard "Geographic Intelligence" expects `{ countries, cities, ... }` with
 * `name`, `count`, `percentage` (map pins use country centroids on the client when needed).
 */
import { analyticsReadSql as pgSql } from "../../../db";
import { siteUniques, topRows } from "../rollups/reads";
import { filterSql } from "../lib/filter-sql";
import { readScope } from "../lib/read-scope";
import type { AnalyticsSpan } from "../lib/analytics-window";

/** The three result sets the raw queries below return, from the rollups. */
async function geoRowsFromRollups(websiteId: string, span: AnalyticsSpan) {
  const [uv, countries, cities] = await Promise.all([
    siteUniques(websiteId, span),
    topRows(websiteId, "country", span, 50, "unique_visitors"),
    topRows(websiteId, "country_city", span, 40, "unique_visitors"),
  ]);
  return [
    [{ uv }],
    countries.map((r) => ({ country: r.k, views: r.views, unique_visitors: r.unique_visitors })),
    cities.map((r) => {
      // Stored as "country|city" so a city name is never merged across countries.
      const [country, ...rest] = r.k.split("|");
      return { city: rest.join("|"), country: country!, views: r.views, unique_visitors: r.unique_visitors };
    }),
  ] as const;
}

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
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const { span, filters, useRollups } = readScope(query);
  const days = span.days;
  const where = () => filterSql(filters, websiteId, span);

  const [totalUvRows, countryRows, cityRows] = useRollups ? await geoRowsFromRollups(websiteId, span) : await Promise.all([
    // Distinct visitors by grouping, not count(DISTINCT …), which always sorts and spilled
    // to disk on large windows (see pages.repository.ts). count(vk) skips a NULL key the
    // same way. The two breakdowns below get a name tiebreaker: ordering by visitors
    // alone returned equal-count rows in a different order from one load to the next.
    pgSql<{ uv: number }[]>`
      SELECT count(vk)::int AS uv
      FROM (
        SELECT coalesce(nullif(trim(visitor_id), ''), session_id) AS vk
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND event_type = 'pageview'
          AND occurred_at >= ${span.start}
          AND occurred_at < ${span.end}
          ${where()}
        GROUP BY 1
      ) visitors
    `,
    pgSql<
      {
        country: string;
        views: number;
        unique_visitors: number;
      }[]
    >`
      SELECT country, sum(n)::int AS views, count(vk)::int AS unique_visitors
      FROM (
        SELECT country, coalesce(nullif(trim(visitor_id), ''), session_id) AS vk, count(*) AS n
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND event_type = 'pageview'
          AND occurred_at >= ${span.start}
          AND occurred_at < ${span.end}
          AND country IS NOT NULL
          AND length(trim(country)) > 0
          ${where()}
        GROUP BY 1, 2
      ) per_visitor
      GROUP BY country
      ORDER BY unique_visitors DESC, country ASC
      LIMIT 50
    `,
    pgSql<
      {
        city: string;
        country: string;
        views: number;
        unique_visitors: number;
      }[]
    >`
      SELECT city, country, sum(n)::int AS views, count(vk)::int AS unique_visitors
      FROM (
        SELECT city, country, coalesce(nullif(trim(visitor_id), ''), session_id) AS vk, count(*) AS n
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND event_type = 'pageview'
          AND occurred_at >= ${span.start}
          AND occurred_at < ${span.end}
          AND city IS NOT NULL
          AND length(trim(city)) > 0
          AND country IS NOT NULL
          AND length(trim(country)) > 0
          ${where()}
        GROUP BY 1, 2, 3
      ) per_visitor
      GROUP BY city, country
      ORDER BY unique_visitors DESC, city ASC, country ASC
      LIMIT 40
    `,
  ]);
  const denom = Math.max(0, totalUvRows[0]?.uv ?? 0);

  const countries = countryRows.map((row) => {
    const code = String(row.country ?? "").trim().toUpperCase();
    const name = code.length === 2 ? iso3166Alpha2ToName(code) : String(row.country ?? "Unknown");
    const count = Number(row.unique_visitors ?? 0);
    const percentage = denom > 0 ? Math.round((count / denom) * 1000) / 10 : 0;
    return { name, code: code.length === 2 ? code : undefined, count, percentage };
  });

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
    website_id: websiteId,
    date_range: `${days}d`,
    countries,
    cities,
    continents: [] as { name: string; count: number; percentage: number }[],
    regions: [] as { name: string; count: number; percentage: number }[],
  };
}
