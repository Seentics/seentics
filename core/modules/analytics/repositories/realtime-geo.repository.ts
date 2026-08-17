import { sql as pgSql } from "../../../db";

const REALTIME_GEO_DEFAULT_MINUTES = 30;

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

export interface RealtimeGeoData {
  website_id: string;
  date_range: string;
  visitors: Array<{
    name: string;
    code?: string;
    count: number;
    percentage: number;
  }>;
}

export async function getRealtimeGeoAnalytics(
  siteId: string,
  opts?: { withinMinutes?: number },
): Promise<RealtimeGeoData> {
  const withinMin = opts?.withinMinutes ?? REALTIME_GEO_DEFAULT_MINUTES;
  const startIso = new Date(Date.now() - withinMin * 60_000).toISOString();

  const rows = await pgSql<{ country: string | null; count: number }[]>`
    SELECT
      country,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS count
    FROM analytics_events
    WHERE website_id  = ${siteId}
      AND event_type  = 'pageview'
      AND occurred_at >= ${startIso}
    GROUP BY country
  `;

  const totalVisitors = rows.reduce((sum, r) => sum + r.count, 0);

  const visitors = rows
    .map((r) => {
      const raw  = r.country?.trim() ?? "";
      const code = raw.length === 2 && /^[A-Z]{2}$/i.test(raw) ? raw.toUpperCase() : undefined;
      const name = code ? iso3166Alpha2ToName(code) : (raw || "Unknown");
      return {
        name,
        code,
        count: r.count,
        percentage: totalVisitors > 0 ? (r.count / totalVisitors) * 100 : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    website_id: siteId,
    date_range: `${withinMin}m`,
    visitors,
  };
}
