/**
 * Analytics queries and read models — one named function per dashboard / API surface.
 * Uses indexed columns: website_id, occurred_at, event_type (see db/schema.ts).
 */
import { and, desc, eq, gte, lte, sql as dsql } from "drizzle-orm";
import { analyticsEvents, db, sql as pgSql, websites } from "../db";
import { log } from "../lib/logger";
import { resolveWebsiteIds } from "../lib/website-resolve";

function parseDays(q: string | undefined, def = 7): number {
  const n = Number(q ?? def);
  return Number.isFinite(n) && n > 0 && n < 366 ? Math.floor(n) : def;
}

async function resolveSiteId(websiteParam: string): Promise<{ siteId: string; uuid: string }> {
  const { siteId, uuidStr } = await resolveWebsiteIds(websiteParam);
  return { siteId, uuid: uuidStr };
}

/** Prefer visitor_id; fall back to session_id so rows aren’t dropped from DISTINCT when vid is null. */
function countDistinctVisitorsSql() {
  return dsql<number>`count(distinct coalesce(nullif(trim(${analyticsEvents.visitorId}), ''), ${analyticsEvents.sessionId}))::int`;
}

function occurredAtToIso(v: Date | string): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

/** High-level KPIs for the main dashboard (single scan where possible). */
export async function getDashboardStats(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const prevStart = new Date(start.getTime() - days * 86400000);
  /** Raw `postgres` tagged queries expect string timestamps here, not `Date` (driver byteLength bind). */
  const endIso = end.toISOString();
  const startIso = start.toISOString();
  const prevStartIso = prevStart.toISOString();

  const [[agg], [sess], live] = await Promise.all([
    pgSql<
      {
        pv: number;
        uv: number;
        prev_pv: number;
        prev_uv: number;
      }[]
    >`
      SELECT
        COALESCE(
          count(*) FILTER (
            WHERE event_type = 'pageview'
              AND occurred_at >= ${startIso}
              AND occurred_at <= ${endIso}
          ),
          0
        )::int AS pv,
        COALESCE(
          count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id)) FILTER (
            WHERE occurred_at >= ${startIso} AND occurred_at <= ${endIso}
          ),
          0
        )::int AS uv,
        COALESCE(
          count(*) FILTER (
            WHERE event_type = 'pageview'
              AND occurred_at >= ${prevStartIso}
              AND occurred_at < ${startIso}
          ),
          0
        )::int AS prev_pv,
        COALESCE(
          count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id)) FILTER (
            WHERE occurred_at >= ${prevStartIso} AND occurred_at < ${startIso}
          ),
          0
        )::int AS prev_uv
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND occurred_at >= ${prevStartIso}
        AND occurred_at <= ${endIso}
    `,
    pgSql<
      {
        session_cnt: number;
        avg_session_sec: number;
        bounce_pct: number;
        prev_session_cnt: number;
        prev_avg_session_sec: number;
        prev_bounce_pct: number;
      }[]
    >`
      WITH e AS (
        SELECT session_id, event_type, occurred_at
        FROM analytics_events
        WHERE website_id = ${siteId}
          AND occurred_at >= ${prevStartIso}
          AND occurred_at <= ${endIso}
      ),
      cur_s AS (
        SELECT
          session_id,
          count(*) FILTER (WHERE event_type = 'pageview')::int AS pvc,
          min(occurred_at) AS mn,
          max(occurred_at) AS mx
        FROM e
        WHERE occurred_at >= ${startIso}
          AND occurred_at <= ${endIso}
          AND session_id IS NOT NULL
          AND length(trim(session_id)) > 0
        GROUP BY session_id
      ),
      prev_s AS (
        SELECT
          session_id,
          count(*) FILTER (WHERE event_type = 'pageview')::int AS pvc,
          min(occurred_at) AS mn,
          max(occurred_at) AS mx
        FROM e
        WHERE occurred_at >= ${prevStartIso}
          AND occurred_at < ${startIso}
          AND session_id IS NOT NULL
          AND length(trim(session_id)) > 0
        GROUP BY session_id
      )
      SELECT
        coalesce((SELECT count(*)::int FROM cur_s), 0) AS session_cnt,
        coalesce(
          (SELECT round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int FROM cur_s),
          0
        ) AS avg_session_sec,
        coalesce(
          (
            SELECT CASE
              WHEN count(*) FILTER (WHERE pvc >= 1) = 0 THEN 0::double precision
              ELSE (count(*) FILTER (WHERE pvc = 1))::double precision * 100.0
                / (count(*) FILTER (WHERE pvc >= 1))::double precision
            END
            FROM cur_s
          ),
          0
        ) AS bounce_pct,
        coalesce((SELECT count(*)::int FROM prev_s), 0) AS prev_session_cnt,
        coalesce(
          (SELECT round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int FROM prev_s),
          0
        ) AS prev_avg_session_sec,
        coalesce(
          (
            SELECT CASE
              WHEN count(*) FILTER (WHERE pvc >= 1) = 0 THEN 0::double precision
              ELSE (count(*) FILTER (WHERE pvc = 1))::double precision * 100.0
                / (count(*) FILTER (WHERE pvc >= 1))::double precision
            END
            FROM prev_s
          ),
          0
        ) AS prev_bounce_pct
    `,
    getRealtimeStats(websiteParam),
  ]);

  const pageViews = Number(agg?.pv ?? 0);
  const uniqueVisitors = Number(agg?.uv ?? 0);
  const prevPv = Number(agg?.prev_pv ?? 0);
  const prevUv = Number(agg?.prev_uv ?? 0);

  const sessionCnt = Number(sess?.session_cnt ?? 0);
  const avgSessionSec = Number(sess?.avg_session_sec ?? 0);
  const bouncePct = Number(sess?.bounce_pct ?? 0);
  const prevSessionCnt = Number(sess?.prev_session_cnt ?? 0);
  const prevAvgSessionSec = Number(sess?.prev_avg_session_sec ?? 0);
  const prevBouncePct = Number(sess?.prev_bounce_pct ?? 0);

  const liveVisitors = Number(live.live_visitors ?? 0);
  const pagesPerSession = sessionCnt > 0 ? pageViews / sessionCnt : 0;

  const visitorChange = prevUv ? ((uniqueVisitors - prevUv) / prevUv) * 100 : 0;
  const pageviewChange = prevPv ? ((pageViews - prevPv) / prevPv) * 100 : 0;
  const sessionChange = prevSessionCnt ? ((sessionCnt - prevSessionCnt) / prevSessionCnt) * 100 : 0;
  const bounceChange = bouncePct - prevBouncePct;
  const durationChange =
    prevAvgSessionSec > 0 ? ((avgSessionSec - prevAvgSessionSec) / prevAvgSessionSec) * 100 : 0;

  log.debug({
    msg: "analytics_dashboard_stats",
    website_param: websiteParam,
    site_id: siteId,
    days,
    page_views: pageViews,
    unique_visitors: uniqueVisitors,
    sessions: sessionCnt,
    live_visitors: liveVisitors,
    bounce_pct: bouncePct,
    avg_session_sec: avgSessionSec,
  });
  if (pageViews === 0 && uniqueVisitors === 0 && sessionCnt === 0) {
    log.debug({
      msg: "analytics_dashboard_zero_in_range",
      website_param: websiteParam,
      site_id: siteId,
      hint: "No rows in analytics_events for this site_id in the selected window. Confirm ingest logs (analytics_ingest_inserted) and DATABASE_URL.",
    });
  }

  return {
    website_id: siteId,
    date_range: `${days}d`,
    total_visitors: uniqueVisitors,
    unique_visitors: uniqueVisitors,
    sessions: sessionCnt,
    live_visitors: liveVisitors,
    page_views: pageViews,
    session_duration: avgSessionSec,
    bounce_rate: bouncePct,
    metrics: {
      page_views: pageViews,
      total_visitors: uniqueVisitors,
      unique_visitors: uniqueVisitors,
      sessions: sessionCnt,
      bounce_rate: bouncePct,
      avg_session_time: avgSessionSec,
      pages_per_session: Math.round(pagesPerSession * 100) / 100,
    },
    comparison: {
      current_period: {
        total_visitors: uniqueVisitors,
        unique_visitors: uniqueVisitors,
        page_views: pageViews,
        sessions: sessionCnt,
        bounce_rate: bouncePct,
        avg_session_time: avgSessionSec,
      },
      previous_period: {
        total_visitors: prevUv,
        unique_visitors: prevUv,
        page_views: prevPv,
        sessions: prevSessionCnt,
        bounce_rate: prevBouncePct,
        avg_session_time: prevAvgSessionSec,
      },
      visitor_change: visitorChange,
      pageview_change: pageviewChange,
      session_change: sessionChange,
      bounce_change: bounceChange,
      duration_change: durationChange,
    },
  };
}

/** Traffic channel summary: direct, organic, referral, social, email, paid. */
export async function getTrafficSummaryStats(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const SOCIAL_DOMAINS = [
    "facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com",
    "pinterest.com", "tiktok.com", "youtube.com", "reddit.com", "snapchat.com",
  ];
  const socialPattern = SOCIAL_DOMAINS.join("|");

  const rows = await pgSql<{
    channel: string;
    views: number;
    unique_visitors: number;
  }[]>`
    SELECT
      CASE
        WHEN utm_medium IN ('cpc', 'ppc', 'paid', 'paid_social', 'paidsearch') THEN 'paid'
        WHEN utm_medium = 'email' OR utm_source = 'email' THEN 'email'
        WHEN utm_medium = 'social'
          OR utm_source IN ('facebook', 'twitter', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit')
          OR (referrer IS NOT NULL AND referrer ~ ${socialPattern}) THEN 'social'
        WHEN referrer IS NOT NULL AND length(trim(referrer)) > 0 AND utm_source IS NULL THEN 'organic'
        WHEN utm_source IS NOT NULL AND length(trim(utm_source)) > 0 THEN 'referral'
        ELSE 'direct'
      END AS channel,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
    GROUP BY channel
    ORDER BY views DESC
  `;

  const channels = rows.map((r) => ({
    channel: r.channel,
    views: Number(r.views),
    unique_visitors: Number(r.unique_visitors),
  }));

  return {
    website_id: siteId,
    date_range: `${days}d`,
    channels,
    total_views: channels.reduce((s, c) => s + c.views, 0),
    total_visitors: channels.reduce((s, c) => s + c.unique_visitors, 0),
  };
}

export async function getActivityTrendsStats(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  return getDailyStatsAnalytics(websiteParam, query);
}

/** Top pages (pageview), grouped by page path, with real bounce_rate. */
export async function getPagesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{
    page: string;
    views: number;
    unique_visitors: number;
    bounce_rate: number;
  }[]>`
    WITH pv AS (
      SELECT
        page,
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
      SELECT session_id, count(*)::int AS pvc
      FROM pv GROUP BY session_id
    )
    SELECT
      pv.page,
      count(*)::int AS views,
      count(DISTINCT pv.vid)::int AS unique_visitors,
      CASE
        WHEN count(DISTINCT pv.session_id) = 0 THEN 0::float
        ELSE round(
          sum(CASE WHEN spc.pvc = 1 THEN 1 ELSE 0 END)::float
          / count(DISTINCT pv.session_id)::float * 100, 1
        )
      END AS bounce_rate
    FROM pv
    JOIN session_pvc spc ON spc.session_id = pv.session_id
    GROUP BY pv.page
    ORDER BY views DESC
    LIMIT 50
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_pages: rows.map((r) => ({
      page: r.page?.trim() ? r.page : "(not set)",
      views: Number(r.views),
      unique: Number(r.unique_visitors),
      bounce_rate: Number(r.bounce_rate),
      avg_time: 0,
    })),
  };
}

export async function getReferrersAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{
    referrer: string | null;
    views: number;
    unique_visitors: number;
    bounce_rate: number;
  }[]>`
    WITH pv AS (
      SELECT
        referrer,
        session_id,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
        occurred_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    first_ref AS (
      SELECT DISTINCT ON (session_id) session_id, referrer
      FROM pv ORDER BY session_id, occurred_at ASC
    ),
    session_pvc AS (
      SELECT session_id, count(*)::int AS pvc
      FROM pv GROUP BY session_id
    )
    SELECT
      coalesce(nullif(trim(fr.referrer), ''), 'direct') AS referrer,
      count(*)::int AS views,
      count(DISTINCT pv.vid)::int AS unique_visitors,
      CASE
        WHEN count(DISTINCT fr.session_id) = 0 THEN 0::float
        ELSE round(
          sum(CASE WHEN spc.pvc = 1 THEN 1 ELSE 0 END)::float
          / count(DISTINCT fr.session_id)::float * 100, 1
        )
      END AS bounce_rate
    FROM first_ref fr
    JOIN session_pvc spc ON spc.session_id = fr.session_id
    JOIN pv ON pv.session_id = fr.session_id
    GROUP BY fr.referrer
    ORDER BY views DESC
    LIMIT 50
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_referrers: rows.map((r) => ({
      referrer: r.referrer ?? "direct",
      views: Number(r.views),
      unique: Number(r.unique_visitors),
      bounce_rate: Number(r.bounce_rate),
    })),
  };
}

export async function getSourcesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{ source: string; views: number; unique_visitors: number; bounce_rate: number }[]>`
    WITH pv AS (
      SELECT
        utm_source,
        session_id,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
        occurred_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND utm_source IS NOT NULL
        AND length(trim(utm_source)) > 0
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    first_src AS (
      SELECT DISTINCT ON (session_id) session_id, utm_source
      FROM pv ORDER BY session_id, occurred_at ASC
    ),
    session_pvc AS (
      SELECT session_id, count(*)::int AS pvc
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
      GROUP BY session_id
    )
    SELECT
      fs.utm_source AS source,
      count(*)::int AS views,
      count(DISTINCT pv.vid)::int AS unique_visitors,
      CASE
        WHEN count(DISTINCT fs.session_id) = 0 THEN 0::float
        ELSE round(
          sum(CASE WHEN spc.pvc = 1 THEN 1 ELSE 0 END)::float
          / count(DISTINCT fs.session_id)::float * 100, 1
        )
      END AS bounce_rate
    FROM first_src fs
    JOIN session_pvc spc ON spc.session_id = fs.session_id
    JOIN pv ON pv.session_id = fs.session_id
    GROUP BY fs.utm_source
    ORDER BY views DESC
    LIMIT 50
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_sources: rows.map((r) => ({
      source: r.source,
      views: Number(r.views),
      unique: Number(r.unique_visitors),
      bounce_rate: Number(r.bounce_rate),
    })),
  };
}

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
      SELECT session_id, count(*)::int AS pvc
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
      GROUP BY session_id
    )
    SELECT
      pv.dim AS k,
      count(*)::int AS views,
      count(DISTINCT pv.vid)::int AS unique_visitors,
      CASE
        WHEN count(DISTINCT pv.session_id) = 0 THEN 0::float
        ELSE round(
          sum(CASE WHEN spc.pvc = 1 THEN 1 ELSE 0 END)::float
          / count(DISTINCT pv.session_id)::float * 100,
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

/**
 * Dashboard "Geographic Intelligence" expects `{ countries, cities, ... }` with
 * `name`, `count`, `percentage` (map pins use country centroids on the client when needed).
 */
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

export async function getLanguagesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      language: analyticsEvents.language,
      views: dsql<number>`count(*)::int`,
      unique: countDistinctVisitorsSql(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    )
    .groupBy(analyticsEvents.language)
    .orderBy(desc(dsql`count(*)`))
    .limit(30);
  return {
    website_id: siteId,
    top_languages: rows
      .filter((r) => r.language)
      .map((r) => ({ language: r.language!, views: r.views, unique: r.unique })),
  };
}

export async function getCitiesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      city: analyticsEvents.city,
      views: dsql<number>`count(*)::int`,
      unique: countDistinctVisitorsSql(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    )
    .groupBy(analyticsEvents.city)
    .orderBy(desc(dsql`count(*)`))
    .limit(30);
  return {
    website_id: siteId,
    top_cities: rows
      .filter((r) => r.city)
      .map((r) => ({ city: r.city!, views: r.views, unique: r.unique })),
  };
}

export async function getResolutionsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();
  const rows = await pgSql<{ resolution: string; views: number; unique: number }[]>`
    SELECT
      screen_width::text || 'x' || screen_height::text AS resolution,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND screen_width IS NOT NULL
      AND screen_height IS NOT NULL
    GROUP BY screen_width, screen_height
    ORDER BY views DESC
    LIMIT 30
  `;
  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_resolutions: rows.map((r) => ({
      resolution: r.resolution,
      views: Number(r.views),
      unique: Number(r.unique),
    })),
  };
}

export async function getRealtimeStats(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  const since = new Date(Date.now() - 5 * 60_000);
  const sinceIso = since.toISOString();

  const [visitors, activePages] = await Promise.all([
    db
      .select({ c: countDistinctVisitorsSql() })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.websiteId, siteId), gte(analyticsEvents.occurredAt, since))),
    pgSql<{ page: string; visitors: number }[]>`
      SELECT
        page,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${sinceIso}
        AND page IS NOT NULL
        AND length(trim(page)) > 0
      GROUP BY page
      ORDER BY visitors DESC
      LIMIT 10
    `,
  ]);

  const liveCount = Number(visitors[0]?.c ?? 0);
  return {
    website_id: siteId,
    active_visitors: liveCount,
    live_visitors: liveCount,
    pages: activePages.map((p) => ({ page: p.page, visitors: Number(p.visitors) })),
  };
}

export async function getLiveVisitorsStats(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  const since = new Date(Date.now() - 5 * 60_000);
  const sinceIso = since.toISOString();

  const [realtimeOut, recentVisitors] = await Promise.all([
    getRealtimeStats(websiteParam),
    pgSql<{
      visitor_id: string;
      session_id: string;
      page: string;
      country: string | null;
      browser: string | null;
      device: string | null;
      occurred_at: string;
    }[]>`
      SELECT DISTINCT ON (coalesce(nullif(trim(visitor_id), ''), session_id))
        coalesce(nullif(trim(visitor_id), ''), session_id) AS visitor_id,
        session_id,
        page,
        country,
        browser,
        device,
        occurred_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND occurred_at >= ${sinceIso}
        AND session_id IS NOT NULL
      ORDER BY coalesce(nullif(trim(visitor_id), ''), session_id), occurred_at DESC
      LIMIT 25
    `,
  ]);

  return {
    website_id: realtimeOut.website_id,
    live_visitors: realtimeOut.live_visitors,
    active_visitors: realtimeOut.active_visitors,
    visitors: recentVisitors.map((v) => ({
      visitor_id: v.visitor_id,
      session_id: v.session_id,
      page: v.page,
      country: v.country ?? null,
      browser: v.browser ?? null,
      device: v.device ?? null,
      last_seen: v.occurred_at,
    })),
  };
}

export async function getDailyStatsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days, 30);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{
    date: string;
    views: number;
    unique_visitors: number;
    avg_session_duration: number;
    bounce_rate: number;
  }[]>`
    WITH pv AS (
      SELECT
        date_trunc('day', occurred_at AT TIME ZONE 'UTC')::date::text AS day,
        event_type,
        session_id,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vid,
        occurred_at
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
    ),
    pageviews AS (
      SELECT day, count(*) AS views, count(DISTINCT vid) AS uniq
      FROM pv WHERE event_type = 'pageview'
      GROUP BY day
    ),
    sess AS (
      SELECT
        day,
        session_id,
        count(*) FILTER (WHERE event_type = 'pageview')::int AS pvc,
        min(occurred_at) AS mn,
        max(occurred_at) AS mx
      FROM pv GROUP BY day, session_id
    ),
    sess_agg AS (
      SELECT
        day,
        round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int AS avg_dur,
        CASE
          WHEN count(*) FILTER (WHERE pvc >= 1) = 0 THEN 0::float
          ELSE (count(*) FILTER (WHERE pvc = 1))::float * 100.0
               / (count(*) FILTER (WHERE pvc >= 1))::float
        END AS bounce_rate
      FROM sess GROUP BY day
    )
    SELECT
      pv.day AS date,
      coalesce(pv.views, 0)::int AS views,
      coalesce(pv.uniq, 0)::int AS unique_visitors,
      coalesce(sa.avg_dur, 0)::int AS avg_session_duration,
      coalesce(sa.bounce_rate, 0)::float AS bounce_rate
    FROM pageviews pv
    LEFT JOIN sess_agg sa ON sa.day = pv.day
    ORDER BY pv.day ASC
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    daily_stats: rows.map((x) => ({
      date: x.date,
      views: Number(x.views),
      unique: Number(x.unique_visitors),
      bounce_rate: Math.round(Number(x.bounce_rate) * 10) / 10,
      avg_session_duration: Number(x.avg_session_duration),
    })),
  };
}

export async function getHourlyStatsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = Math.min(parseDays(query.days, 1), 7);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const hourBucket = dsql<number>`extract(hour from ${analyticsEvents.occurredAt} AT TIME ZONE 'UTC')::int`;
  const rows = await db
    .select({
      h: hourBucket,
      views: dsql<number>`count(*)::int`,
      unique: countDistinctVisitorsSql(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    )
    .groupBy(hourBucket)
    .orderBy(hourBucket);
  const todayUtcMidnight = new Date();
  todayUtcMidnight.setUTCHours(0, 0, 0, 0);
  return {
    website_id: siteId,
    hourly_stats: rows.map((x) => ({
      hour: x.h,
      timestamp: new Date(todayUtcMidnight.getTime() + x.h * 3600_000).toISOString(),
      views: x.views,
      unique: x.unique,
      hour_label: `${String(x.h).padStart(2, "0")}:00`,
    })),
  };
}

export async function getCustomEventsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const rows = await db
    .select({
      eventType: analyticsEvents.eventType,
      c: dsql<number>`count(*)::int`,
      uniqueVisitors: countDistinctVisitorsSql(),
      uniqueSessions: dsql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        lte(analyticsEvents.occurredAt, end),
        dsql`${analyticsEvents.eventType} <> 'pageview'`,
      ),
    )
    .groupBy(analyticsEvents.eventType)
    .orderBy(desc(dsql`count(*)`))
    .limit(100);

  const eventPayload = rows.map((x) => ({
    event_type: x.eventType,
    count: x.c,
    description: "",
    common_properties: {},
    sample_properties: {},
    sample_event: {},
    unique_visitors: Number(x.uniqueVisitors),
    unique_sessions: Number(x.uniqueSessions),
    engagement_rate: 0,
    expected_properties: [] as string[],
  }));

  type UtmRow = { visits: number; unique_visitors: number; label: string };
  const [sourceRows, mediumRows, campaignRows] = await Promise.all([
    pgSql<UtmRow[]>`
      SELECT
        utm_source AS label,
        count(*)::int AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_source IS NOT NULL
        AND length(trim(utm_source)) > 0
      GROUP BY utm_source
      ORDER BY visits DESC
      LIMIT 50
    `,
    pgSql<UtmRow[]>`
      SELECT
        utm_medium AS label,
        count(*)::int AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_medium IS NOT NULL
        AND length(trim(utm_medium)) > 0
      GROUP BY utm_medium
      ORDER BY visits DESC
      LIMIT 50
    `,
    pgSql<UtmRow[]>`
      SELECT
        utm_campaign AS label,
        count(*)::int AS visits,
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND utm_campaign IS NOT NULL
        AND length(trim(utm_campaign)) > 0
      GROUP BY utm_campaign
      ORDER BY visits DESC
      LIMIT 50
    `,
  ]);

  const mapSrc = (r: UtmRow) => ({
    source: r.label,
    unique_visitors: Number(r.unique_visitors ?? 0),
    visits: Number(r.visits ?? 0),
  });
  const mapMed = (r: UtmRow) => ({
    medium: r.label,
    unique_visitors: Number(r.unique_visitors ?? 0),
    visits: Number(r.visits ?? 0),
  });
  const mapCamp = (r: UtmRow) => ({
    campaign: r.label,
    unique_visitors: Number(r.unique_visitors ?? 0),
    visits: Number(r.visits ?? 0),
  });

  const sources = sourceRows.map(mapSrc);
  const mediums = mediumRows.map(mapMed);
  const campaigns = campaignRows.map(mapCamp);

  return {
    website_id: siteId,
    events: eventPayload,
    top_events: eventPayload,
    utm_performance: {
      sources,
      mediums,
      campaigns,
      terms: [] as { term: string; unique_visitors: number; visits: number }[],
      content: [] as { content: string; unique_visitors: number; visits: number }[],
      avg_ctr: 0,
      total_campaigns: campaigns.length,
      total_sources: sources.length,
      total_mediums: mediums.length,
    },
    total_events: rows.length,
    total_occurrences: rows.reduce((a, x) => a + x.c, 0),
  };
}

export async function getGoalsStats(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId, uuid } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const siteUvRows = await pgSql<{ uv: number }[]>`
    SELECT
      COALESCE(
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id)),
        0
      )::int AS uv
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND occurred_at <= ${endIso}
  `;
  const siteUv = siteUvRows[0]?.uv ?? 0;
  const denom = siteUv > 0 ? siteUv : 0;

  const rows = await pgSql<
    {
      id: string;
      name: string;
      goal_type: string;
      target: string;
      completions: number;
      unique_visitors: number;
    }[]
  >`
    SELECT
      g.id::text AS id,
      g.name AS name,
      g."type" AS goal_type,
      g.identifier AS target,
      count(ae.id)::int AS completions,
      count(
        DISTINCT coalesce(nullif(trim(ae.visitor_id), ''), ae.session_id)
      ) FILTER (WHERE ae.id IS NOT NULL)::int AS unique_visitors
    FROM goals g
    LEFT JOIN analytics_events ae
      ON ae.website_id = ${siteId}
      AND ae.occurred_at >= ${startIso}
      AND ae.occurred_at <= ${endIso}
      AND (
        (
          g."type" = 'pageview'
          AND ae.event_type = 'pageview'
          AND (
            ae.page = g.identifier
            OR strpos(lower(coalesce(ae.page, '')), lower(g.identifier)) > 0
          )
        )
        OR (
          (g."type" = 'event' OR g."type" = 'click')
          AND ae.event_type = 'custom'
          AND coalesce(ae.properties->>'name', '') = g.identifier
        )
      )
    WHERE g.website_id = ${uuid}::uuid
    GROUP BY g.id, g.name, g."type", g.identifier
    ORDER BY min(g.created_at) ASC
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    goals: rows.map((r) => {
      const uv = Number(r.unique_visitors ?? 0);
      const rate = denom > 0 ? Math.round((uv / denom) * 1000) / 10 : 0;
      return {
        id: r.id,
        name: r.name,
        goal_type: r.goal_type,
        target: r.target,
        completions: Number(r.completions ?? 0),
        unique_visitors: uv,
        conversion_rate: rate,
      };
    }),
  };
}

export async function getVisitorInsightsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const entrySql = pgSql<{ page: string; sessions: number }[]>`
    WITH pv AS (
      SELECT
        session_id,
        page,
        ROW_NUMBER() OVER (
          PARTITION BY session_id
          ORDER BY occurred_at ASC, id ASC
        ) AS rn
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
        AND page IS NOT NULL
        AND length(trim(page)) > 0
    )
    SELECT page, count(*)::int AS sessions
    FROM pv
    WHERE rn = 1
    GROUP BY page
    ORDER BY count(*) DESC
    LIMIT 30
  `;

  const exitSql = pgSql<{ page: string; sessions: number }[]>`
    WITH pv AS (
      SELECT
        session_id,
        page,
        ROW_NUMBER() OVER (
          PARTITION BY session_id
          ORDER BY occurred_at DESC, id DESC
        ) AS rn
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
        AND page IS NOT NULL
        AND length(trim(page)) > 0
    )
    SELECT page, count(*)::int AS sessions
    FROM pv
    WHERE rn = 1
    GROUP BY page
    ORDER BY count(*) DESC
    LIMIT 30
  `;

  const newReturningSql = pgSql<{ new_visitors: number; returning_visitors: number }[]>`
    WITH period_vids AS (
      SELECT DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
    ),
    prev_vids AS (
      SELECT DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id) AS vid
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at < ${startIso}
    )
    SELECT
      count(*) FILTER (WHERE vid NOT IN (SELECT vid FROM prev_vids))::int AS new_visitors,
      count(*) FILTER (WHERE vid IN (SELECT vid FROM prev_vids))::int AS returning_visitors
    FROM period_vids
  `;

  const avgDurSql = pgSql<{ avg_dur: number }[]>`
    SELECT round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int AS avg_dur
    FROM (
      SELECT session_id, min(occurred_at) AS mn, max(occurred_at) AS mx
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND occurred_at >= ${startIso}
        AND occurred_at <= ${endIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
      GROUP BY session_id
    ) s
  `;

  const [topEntryPages, topExitPages, newReturning, avgDurRows] = await Promise.all([
    entrySql,
    exitSql,
    newReturningSql,
    avgDurSql,
  ]);

  return {
    website_id: siteId,
    date_range: `${days}d`,
    visitor_insights: {
      new_visitors: Number(newReturning[0]?.new_visitors ?? 0),
      returning_visitors: Number(newReturning[0]?.returning_visitors ?? 0),
      avg_session_duration: Number(avgDurRows[0]?.avg_dur ?? 0),
      top_entry_pages: topEntryPages.map((r) => ({
        page: r.page,
        sessions: Number(r.sessions ?? 0),
      })),
      top_exit_pages: topExitPages.map((r) => ({
        page: r.page,
        sessions: Number(r.sessions ?? 0),
      })),
    },
  };
}

const RECENT_ACTIVITY_DEFAULT_DAYS = 30;

export async function getRecentActivityAnalytics(websiteParam: string, limit: number) {
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - RECENT_ACTIVITY_DEFAULT_DAYS * 86400000);
  const rows = await db
    .select({
      eventType: analyticsEvents.eventType,
      page: analyticsEvents.page,
      visitorId: analyticsEvents.visitorId,
      sessionId: analyticsEvents.sessionId,
      country: analyticsEvents.country,
      browser: analyticsEvents.browser,
      device: analyticsEvents.device,
      referrer: analyticsEvents.referrer,
      occurredAt: analyticsEvents.occurredAt,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(Math.min(limit, 100));
  return {
    website_id: siteId,
    date_range: `${RECENT_ACTIVITY_DEFAULT_DAYS}d`,
    activity: rows.map((e) => ({
      type: e.eventType,
      page: e.page,
      visitor_id: e.visitorId,
      session_id: e.sessionId,
      country: e.country,
      browser: e.browser,
      device: e.device,
      referrer: e.referrer,
      occurred_at: occurredAtToIso(e.occurredAt as Date | string),
    })),
  };
}

export async function getPathAnalysisAnalytics(
  websiteParam: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 7);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const paths = await pgSql<{
    page_1: string;
    page_2: string | null;
    page_3: string | null;
    sessions: number;
  }[]>`
    WITH ordered AS (
      SELECT
        session_id,
        page,
        ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY occurred_at ASC, id ASC) AS step
      FROM analytics_events
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
        AND session_id IS NOT NULL
        AND length(trim(session_id)) > 0
        AND page IS NOT NULL
        AND length(trim(page)) > 0
    )
    SELECT
      p1.page AS page_1,
      p2.page AS page_2,
      p3.page AS page_3,
      count(DISTINCT p1.session_id)::int AS sessions
    FROM ordered p1
    LEFT JOIN ordered p2 ON p2.session_id = p1.session_id AND p2.step = 2
    LEFT JOIN ordered p3 ON p3.session_id = p1.session_id AND p3.step = 3
    WHERE p1.step = 1
    GROUP BY p1.page, p2.page, p3.page
    ORDER BY sessions DESC
    LIMIT 50
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    paths: paths.map((r) => ({
      page_1: r.page_1,
      page_2: r.page_2 ?? null,
      page_3: r.page_3 ?? null,
      sessions: Number(r.sessions),
    })),
  };
}

export async function getPageUtmBreakdownAnalytics(
  websiteParam: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 7);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const rows = await pgSql<{
    page: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    views: number;
    unique_visitors: number;
  }[]>`
    SELECT
      page,
      utm_source,
      utm_medium,
      utm_campaign,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
      AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
      AND page IS NOT NULL
    GROUP BY page, utm_source, utm_medium, utm_campaign
    ORDER BY views DESC
    LIMIT 200
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    breakdown: rows.map((r) => ({
      page: r.page,
      utm_source: r.utm_source ?? null,
      utm_medium: r.utm_medium ?? null,
      utm_campaign: r.utm_campaign ?? null,
      views: Number(r.views),
      unique_visitors: Number(r.unique_visitors),
    })),
  };
}

export async function getExportAnalytics(
  websiteParam: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 30);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      eventType: analyticsEvents.eventType,
      page: analyticsEvents.page,
      visitorId: analyticsEvents.visitorId,
      sessionId: analyticsEvents.sessionId,
      referrer: analyticsEvents.referrer,
      country: analyticsEvents.country,
      city: analyticsEvents.city,
      browser: analyticsEvents.browser,
      device: analyticsEvents.device,
      os: analyticsEvents.os,
      language: analyticsEvents.language,
      utmSource: analyticsEvents.utmSource,
      utmMedium: analyticsEvents.utmMedium,
      utmCampaign: analyticsEvents.utmCampaign,
      screenWidth: analyticsEvents.screenWidth,
      screenHeight: analyticsEvents.screenHeight,
      occurredAt: analyticsEvents.occurredAt,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(10_000);
  return {
    website_id: siteId,
    date_range: `${days}d`,
    format: "json",
    total: rows.length,
    data: rows.map((e) => ({
      event_type: e.eventType,
      page: e.page,
      visitor_id: e.visitorId,
      session_id: e.sessionId,
      referrer: e.referrer,
      country: e.country,
      city: e.city,
      browser: e.browser,
      device: e.device,
      os: e.os,
      language: e.language,
      utm_source: e.utmSource,
      utm_medium: e.utmMedium,
      utm_campaign: e.utmCampaign,
      screen_width: e.screenWidth,
      screen_height: e.screenHeight,
      occurred_at: occurredAtToIso(e.occurredAt as Date | string),
    })),
  };
}

export async function importAnalytics() {
  return { ok: true };
}

export async function getPublicDashboardStats(
  publicId: string,
  query: Record<string, string | undefined>,
) {
  const [w] = await db.select().from(websites).where(eq(websites.publicShareId, publicId)).limit(1);
  if (!w) return null;
  return getDashboardStats(w.id, query);
}
