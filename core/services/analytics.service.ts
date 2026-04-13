/**
 * Analytics queries and read models — one named function per dashboard / API surface.
 * Uses indexed columns: website_site_id, occurred_at, event_type (see db/schema.ts).
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
      WHERE website_site_id = ${siteId}
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
        WHERE website_site_id = ${siteId}
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

export async function getTrafficSummaryStats(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  return getDashboardStats(websiteParam, query);
}

export async function getActivityTrendsStats(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  return getDailyStatsAnalytics(websiteParam, query);
}

/** Top pages (pageview), grouped by page path. */
export async function getPagesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      page: analyticsEvents.page,
      views: dsql<number>`count(*)::int`,
      unique: countDistinctVisitorsSql(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    )
    .groupBy(analyticsEvents.page)
    .orderBy(desc(dsql`count(*)`))
    .limit(50);
  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_pages: rows.map((r) => ({
      page: r.page?.trim() ? r.page : "(not set)",
      views: r.views,
      unique: r.unique,
      bounce_rate: 0,
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
  const rows = await db
    .select({
      referrer: analyticsEvents.referrer,
      views: dsql<number>`count(*)::int`,
      unique: countDistinctVisitorsSql(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    )
    .groupBy(analyticsEvents.referrer)
    .orderBy(desc(dsql`count(*)`))
    .limit(50);
  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_referrers: rows.map((r) => ({
      referrer: r.referrer || "direct",
      views: r.views,
      unique: r.unique,
      bounce_rate: 0,
    })),
  };
}

export async function getSourcesAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  return getReferrersAnalytics(websiteParam, query);
}

async function topDimensionAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
  col: "country" | "browser" | "device" | "os",
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const colExpr =
    col === "country"
      ? analyticsEvents.country
      : col === "browser"
        ? analyticsEvents.browser
        : col === "device"
          ? analyticsEvents.device
          : analyticsEvents.os;
  const rows = await db
    .select({
      k: colExpr,
      views: dsql<number>`count(*)::int`,
      unique: countDistinctVisitorsSql(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    )
    .groupBy(colExpr)
    .orderBy(desc(dsql`count(*)`))
    .limit(50);
  const label =
    col === "country" ? "country" : col === "browser" ? "browser" : col === "device" ? "device" : "os";
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
    [key]: rows
      .filter((r) => r.k)
      .map((r) => ({
        [label]: r.k!,
        views: r.views,
        unique: r.unique,
        bounce_rate: 0,
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
 * `name`, `count`, `percentage` — not raw `top_countries` rows. Country codes in DB are ISO3166-1 alpha-2.
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
    WHERE website_site_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
  `;
  const denom = Math.max(0, totalUvRows[0]?.uv ?? 0);

  const d = (await getCountriesAnalytics(websiteParam, query)) as unknown as {
    website_id: string;
    date_range: string;
    top_countries: { country: string; views: number; unique: number }[];
  };

  const countries = (d.top_countries ?? []).map((row) => {
    const code = String(row.country ?? "").trim().toUpperCase();
    const name = code.length === 2 ? iso3166Alpha2ToName(code) : String(row.country ?? "Unknown");
    const count = Number(row.unique ?? 0);
    const percentage = denom > 0 ? Math.round((count / denom) * 1000) / 10 : 0;
    return { name, code: code.length === 2 ? code : undefined, count, percentage };
  });

  const cityAgg = await getCitiesAnalytics(websiteParam, query);
  const cities = (cityAgg.top_cities ?? []).map((row) => {
    const count = Number(row.unique ?? 0);
    const percentage = denom > 0 ? Math.round((count / denom) * 1000) / 10 : 0;
    return { name: row.city ?? "Unknown", count, percentage };
  });

  return {
    website_id: d.website_id,
    date_range: d.date_range,
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
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, start)))
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
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, start)))
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
  void days;
  return { website_id: siteId, top_resolutions: [] as { resolution: string; views: number; unique: number }[] };
}

export async function getRealtimeStats(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  const since = new Date(Date.now() - 5 * 60_000);
  const [r] = await db
    .select({ c: countDistinctVisitorsSql() })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, since)));
  return {
    website_id: siteId,
    active_visitors: Number(r?.c ?? 0),
    live_visitors: Number(r?.c ?? 0),
    pages: [] as unknown[],
  };
}

export async function getLiveVisitorsStats(websiteParam: string) {
  const out = await getRealtimeStats(websiteParam);
  return {
    website_id: out.website_id,
    live_visitors: out.live_visitors,
    active_visitors: out.active_visitors,
    visitors: [] as unknown[],
  };
}

export async function getDailyStatsAnalytics(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days, 30);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const dayBucket = dsql<string>`date_trunc('day', ${analyticsEvents.occurredAt} AT TIME ZONE 'UTC')::date::text`;
  const rows = await db
    .select({
      d: dayBucket,
      views: dsql<number>`count(*)::int`,
      unique: countDistinctVisitorsSql(),
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .groupBy(dayBucket)
    .orderBy(dayBucket);
  return {
    website_id: siteId,
    date_range: `${days}d`,
    daily_stats: rows.map((x) => ({
      date: x.d,
      views: x.views,
      unique: x.unique,
      bounce_rate: 0,
      avg_session_duration: 0,
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
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .groupBy(hourBucket)
    .orderBy(hourBucket);
  return {
    website_id: siteId,
    hourly_stats: rows.map((x) => ({
      hour: x.h,
      timestamp: new Date().toISOString(),
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
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
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
    unique_visitors: 0,
    unique_sessions: 0,
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
      WHERE website_site_id = ${siteId}
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
      WHERE website_site_id = ${siteId}
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
      WHERE website_site_id = ${siteId}
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
        count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id)) FILTER (
          WHERE occurred_at >= ${startIso} AND occurred_at <= ${endIso}
        ),
        0
      )::int AS uv
    FROM analytics_events
    WHERE website_site_id = ${siteId}
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
      ON ae.website_site_id = ${siteId}
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
      WHERE website_site_id = ${siteId}
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
      WHERE website_site_id = ${siteId}
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

  const [topEntryPages, topExitPages] = await Promise.all([entrySql, exitSql]);

  return {
    website_id: siteId,
    date_range: `${days}d`,
    visitor_insights: {
      new_visitors: 0,
      returning_visitors: 0,
      avg_session_duration: 0,
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
    .select()
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(Math.min(limit, 100));
  return {
    website_id: siteId,
    date_range: `${RECENT_ACTIVITY_DEFAULT_DAYS}d`,
    activity: rows.map((e) => ({
      type: e.eventType,
      page: e.page,
      visitor_id: e.visitorId,
      occurred_at: occurredAtToIso(e.occurredAt as Date | string),
    })),
  };
}

export async function getPathAnalysisAnalytics(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  return { website_id: siteId, paths: [] };
}

export async function getPageUtmBreakdownAnalytics(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  return { website_id: siteId, breakdown: [] };
}

export async function getExportAnalytics(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  return { website_id: siteId, format: "json", data: [] as unknown[] };
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
