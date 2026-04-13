import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { analyticsEvents, db, websites } from "../db";
import { resolveWebsiteIds } from "../lib/website-resolve";

function parseDays(q: string | undefined, def = 7): number {
  const n = Number(q ?? def);
  return Number.isFinite(n) && n > 0 && n < 366 ? Math.floor(n) : def;
}

async function resolveSiteId(websiteParam: string): Promise<{ siteId: string; uuid: string }> {
  const { siteId, uuidStr } = await resolveWebsiteIds(websiteParam);
  return { siteId, uuid: uuidStr };
}

export async function getDashboard(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const prevStart = new Date(start.getTime() - days * 86400000);

  const [pv] = await db
    .select({ c: count() })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        lte(analyticsEvents.occurredAt, end),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    );
  const [uv] = await db
    .select({ c: sql<number>`count(distinct ${analyticsEvents.visitorId})::int` })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        lte(analyticsEvents.occurredAt, end),
      ),
    );

  const [pvP] = await db
    .select({ c: count() })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
        gte(analyticsEvents.occurredAt, prevStart),
        lte(analyticsEvents.occurredAt, start),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    );

  const pageViews = Number(pv?.c ?? 0);
  const uniqueVisitors = Number(uv?.c ?? 0);
  const prevPv = Number(pvP?.c ?? 0);

  return {
    website_id: siteId,
    date_range: `${days}d`,
    total_visitors: uniqueVisitors,
    unique_visitors: uniqueVisitors,
    sessions: uniqueVisitors,
    live_visitors: 0,
    page_views: pageViews,
    session_duration: 0,
    bounce_rate: 0,
    metrics: {
      page_views: pageViews,
      total_visitors: uniqueVisitors,
      unique_visitors: uniqueVisitors,
      sessions: uniqueVisitors,
      bounce_rate: 0,
      avg_session_time: 0,
      pages_per_session: 0,
    },
    comparison: {
      current_period: {
        total_visitors: uniqueVisitors,
        unique_visitors: uniqueVisitors,
        page_views: pageViews,
        sessions: uniqueVisitors,
        bounce_rate: 0,
        avg_session_time: 0,
      },
      previous_period: {
        total_visitors: Math.max(0, Math.floor(uniqueVisitors * (prevPv / (pageViews || 1)))),
        unique_visitors: 0,
        page_views: prevPv,
        sessions: 0,
        bounce_rate: 0,
        avg_session_time: 0,
      },
      visitor_change: prevPv ? ((pageViews - prevPv) / prevPv) * 100 : 0,
      pageview_change: prevPv ? ((pageViews - prevPv) / prevPv) * 100 : 0,
      session_change: 0,
      bounce_change: 0,
      duration_change: 0,
    },
  };
}

export async function topPages(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      page: analyticsEvents.page,
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
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
    .orderBy(desc(sql`count(*)`))
    .limit(50);
  return {
    website_id: siteId,
    date_range: `${days}d`,
    top_pages: rows
      .filter((r) => r.page)
      .map((r) => ({
        page: r.page!,
        views: r.views,
        unique: r.unique,
        bounce_rate: 0,
        avg_time: 0,
      })),
  };
}

async function topByColumn(
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
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
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
    .orderBy(desc(sql`count(*)`))
    .limit(50);
  const label = col === "country" ? "country" : col === "browser" ? "browser" : col === "device" ? "device" : "os";
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

export const topCountries = (w: string, q: Record<string, string | undefined>) => topByColumn(w, q, "country");
export const topBrowsers = (w: string, q: Record<string, string | undefined>) => topByColumn(w, q, "browser");
export const topDevices = (w: string, q: Record<string, string | undefined>) => topByColumn(w, q, "device");
export const topOS = (w: string, q: Record<string, string | undefined>) => topByColumn(w, q, "os");

export async function topReferrers(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      referrer: analyticsEvents.referrer,
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
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
    .orderBy(desc(sql`count(*)`))
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

export async function realtime(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  const since = new Date(Date.now() - 5 * 60_000);
  const [r] = await db
    .select({ c: sql<number>`count(distinct ${analyticsEvents.visitorId})::int` })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, since)));
  return {
    website_id: siteId,
    active_visitors: Number(r?.c ?? 0),
    live_visitors: Number(r?.c ?? 0),
    pages: [],
  };
}

export async function liveVisitors(websiteParam: string) {
  const out = await realtime(websiteParam);
  return { website_id: out.website_id, visitors: [] };
}

export async function dailyStats(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days, 30);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const dayBucket = sql<string>`date_trunc('day', ${analyticsEvents.occurredAt} AT TIME ZONE 'UTC')::date::text`;
  const rows = await db
    .select({
      d: dayBucket,
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
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

export async function hourlyStats(websiteParam: string, query: Record<string, string | undefined>) {
  const days = Math.min(parseDays(query.days, 1), 7);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const hourBucket = sql<number>`extract(hour from ${analyticsEvents.occurredAt} AT TIME ZONE 'UTC')::int`;
  const rows = await db
    .select({
      h: hourBucket,
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
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

export async function customEvents(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      eventType: analyticsEvents.eventType,
      c: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
        gte(analyticsEvents.occurredAt, start),
        sql`${analyticsEvents.eventType} <> 'pageview'`,
      ),
    )
    .groupBy(analyticsEvents.eventType)
    .orderBy(desc(sql`count(*)`))
    .limit(100);
  return {
    website_id: siteId,
    events: rows.map((x) => ({
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
    })),
    total_events: rows.length,
    total_occurrences: rows.reduce((a, x) => a + x.c, 0),
  };
}

export async function goalsStats(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  void days;
  return { website_id: siteId, date_range: `${days}d`, goals: [] };
}

export async function visitorInsights(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  return {
    website_id: siteId,
    date_range: `${days}d`,
    visitor_insights: {
      new_visitors: 0,
      returning_visitors: 0,
      avg_session_duration: 0,
      top_entry_pages: [],
      top_exit_pages: [],
    },
  };
}

export async function recentActivity(websiteParam: string, limit: number) {
  const { siteId } = await resolveSiteId(websiteParam);
  const rows = await db
    .select()
    .from(analyticsEvents)
    .where(eq(analyticsEvents.websiteSiteId, siteId))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(Math.min(limit, 100));
  return {
    website_id: siteId,
    activity: rows.map((e) => ({
      type: e.eventType,
      page: e.page,
      visitor_id: e.visitorId,
      occurred_at: e.occurredAt.toISOString(),
    })),
  };
}

export async function geolocation(websiteParam: string, query: Record<string, string | undefined>) {
  const d = (await topCountries(websiteParam, query)) as unknown as {
    website_id: string;
    date_range: string;
    top_countries: { country: string; views: number; unique: number }[];
  };
  return {
    website_id: d.website_id,
    date_range: d.date_range,
    countries: d.top_countries ?? [],
  };
}

export async function pathAnalysis(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  return { website_id: siteId, paths: [] };
}

export async function trafficSummary(websiteParam: string, query: Record<string, string | undefined>) {
  return getDashboard(websiteParam, query);
}

export async function activityTrends(websiteParam: string, query: Record<string, string | undefined>) {
  return dailyStats(websiteParam, query);
}

export async function topLanguages(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      language: analyticsEvents.language,
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .groupBy(analyticsEvents.language)
    .orderBy(desc(sql`count(*)`))
    .limit(30);
  return {
    website_id: siteId,
    top_languages: rows.filter((r) => r.language).map((r) => ({ language: r.language!, views: r.views, unique: r.unique })),
  };
}

export async function topCities(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const rows = await db
    .select({
      city: analyticsEvents.city,
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, start)))
    .groupBy(analyticsEvents.city)
    .orderBy(desc(sql`count(*)`))
    .limit(30);
  return {
    website_id: siteId,
    top_cities: rows.filter((r) => r.city).map((r) => ({ city: r.city!, views: r.views, unique: r.unique })),
  };
}

export async function topResolutions(websiteParam: string, query: Record<string, string | undefined>) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  void days;
  return { website_id: siteId, top_resolutions: [] as { resolution: string; views: number; unique: number }[] };
}

export async function pageUtmBreakdown(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  return { website_id: siteId, breakdown: [] };
}

export async function topSources(websiteParam: string, query: Record<string, string | undefined>) {
  return topReferrers(websiteParam, query);
}

export async function exportAnalytics(websiteParam: string) {
  const { siteId } = await resolveSiteId(websiteParam);
  return { website_id: siteId, format: "json", data: [] };
}

export async function importAnalytics() {
  return { ok: true };
}

export async function publicDashboard(publicId: string, query: Record<string, string | undefined>) {
  const [w] = await db.select().from(websites).where(eq(websites.publicShareId, publicId)).limit(1);
  if (!w) return null;
  return getDashboard(w.id, query);
}
