import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "./helpers/fake-db";

/**
 * Time series, journey analysis, and extraction.
 *
 * The recurring risk in this group is the window: `hourly-stats` clamps to a week on
 * top of the shared clamp, `daily-stats` and `export` default to thirty days rather
 * than seven, and `activity-trends` is a re-export whose contract is that it stays
 * identical to daily stats. Each of those is a place where a plausible edit changes
 * what a chart is actually showing without changing its label.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

/* eslint-disable @typescript-eslint/no-explicit-any */
let getDailyStatsAnalytics: any;
let getHourlyStatsAnalytics: any;
let getActivityTrendsStats: any;
let getVisitorInsightsAnalytics: any;
let getPathAnalysisAnalytics: any;
let getCustomEventsAnalytics: any;
let getExportAnalytics: any;

beforeAll(async () => {
  ({ getDailyStatsAnalytics } = await import("../repositories/daily-stats.repository"));
  ({ getHourlyStatsAnalytics } = await import("../repositories/hourly-stats.repository"));
  ({ getActivityTrendsStats } = await import("../repositories/activity-trends.repository"));
  ({ getVisitorInsightsAnalytics } = await import("../repositories/visitor-insights.repository"));
  ({ getPathAnalysisAnalytics } = await import("../repositories/path-analysis.repository"));
  ({ getCustomEventsAnalytics } = await import("../repositories/custom-events.repository"));
  ({ getExportAnalytics } = await import("../repositories/export.repository"));
});

beforeEach(resetDb);

const SITE = "site_1";

/** How many days back the query's window bind reaches. */
function windowDays(callIndex = 0): number {
  const start = sqlCalls[callIndex]!.values.find(
    (v): v is string => typeof v === "string" && v.endsWith("Z"),
  )!;
  return Math.round((Date.now() - new Date(start).getTime()) / 86_400_000);
}

/** The timezone the query interpolated, as the identifier/bind it was passed as. */
function boundTimezone(callIndex = 0): unknown {
  return sqlCalls[callIndex]!.values.find(
    (v) => typeof v === "string" && !v.endsWith("Z") && v !== SITE,
  );
}

// ─── Daily stats ─────────────────────────────────────────────────────────────

describe("getDailyStatsAnalytics", () => {
  it("publishes rows under daily_stats with `views` and `unique`", async () => {
    queueRows([{ date: "2026-03-01", views: 120, unique_visitors: 80 }]);
    expect(await getDailyStatsAnalytics(SITE, {})).toEqual({
      daily_stats: [{ date: "2026-03-01", views: 120, unique: 80 }],
    });
  });

  it("defaults to a thirty-day window, not the shared seven", async () => {
    queueRows([]);
    await getDailyStatsAnalytics(SITE, {});
    expect(windowDays()).toBe(30);
  });

  it("honours an explicit window inside the clamp", async () => {
    queueRows([]);
    await getDailyStatsAnalytics(SITE, { days: "90" });
    expect(windowDays()).toBe(90);
  });

  it("falls back to thirty days for an out-of-range window", async () => {
    queueRows([]);
    await getDailyStatsAnalytics(SITE, { days: "5000" });
    expect(windowDays()).toBe(30);
  });

  it("buckets in the caller's timezone", async () => {
    queueRows([]);
    await getDailyStatsAnalytics(SITE, { timezone: "Asia/Dhaka" });
    expect(boundTimezone()).toBe("Asia/Dhaka");
  });

  it("substitutes UTC for a timezone that would break the AT TIME ZONE clause", async () => {
    queueRows([]);
    await getDailyStatsAnalytics(SITE, { timezone: "UTC'; DROP TABLE analytics_events; --" });
    expect(boundTimezone()).toBe("UTC");
  });

  it("returns an empty series rather than omitting the key", async () => {
    queueRows([]);
    expect(await getDailyStatsAnalytics(SITE, {})).toEqual({ daily_stats: [] });
  });

  it("preserves the query's chronological ordering", async () => {
    queueRows([
      { date: "2026-03-01", views: 1, unique_visitors: 1 },
      { date: "2026-03-02", views: 2, unique_visitors: 2 },
    ]);
    const out = await getDailyStatsAnalytics(SITE, {});
    expect(out.daily_stats.map((d: { date: string }) => d.date)).toEqual([
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});

// ─── Activity trends ─────────────────────────────────────────────────────────

describe("getActivityTrendsStats", () => {
  it("is byte-for-byte the daily-stats payload", async () => {
    // The endpoint exists as its own route, but its contract is that it *is* daily
    // stats. If that ever stops being true it must be a deliberate edit, not a drift.
    const rows = [{ date: "2026-03-01", views: 5, unique_visitors: 3 }];

    queueRows(rows);
    const daily = await getDailyStatsAnalytics(SITE, { days: "14" });

    resetDb();
    queueRows(rows);
    const trends = await getActivityTrendsStats(SITE, { days: "14" });

    expect(trends).toEqual(daily);
  });

  it("inherits the thirty-day default", async () => {
    queueRows([]);
    await getActivityTrendsStats(SITE, {});
    expect(windowDays()).toBe(30);
  });
});

// ─── Hourly stats ────────────────────────────────────────────────────────────

describe("getHourlyStatsAnalytics", () => {
  it("publishes rows with a zero-padded HH:00 label", async () => {
    queueRows([
      { h: 0, views: 4, unique: 3 },
      { h: 9, views: 12, unique: 9 },
      { h: 23, views: 1, unique: 1 },
    ]);
    const out = await getHourlyStatsAnalytics(SITE, {});
    expect(out.hourly_stats).toEqual([
      { hour: 0, views: 4, unique: 3, hour_label: "00:00" },
      { hour: 9, views: 12, unique: 9, hour_label: "09:00" },
      { hour: 23, views: 1, unique: 1, hour_label: "23:00" },
    ]);
  });

  it("defaults to a one-day window", async () => {
    queueRows([]);
    await getHourlyStatsAnalytics(SITE, {});
    expect(windowDays()).toBe(1);
  });

  it("clamps to seven days on top of the shared clamp", async () => {
    // Aggregating the same clock hour across more than a week makes the chart a blur;
    // this second clamp is the reason there is no `timestamp` on each bucket.
    queueRows([]);
    await getHourlyStatsAnalytics(SITE, { days: "30" });
    expect(windowDays()).toBe(7);

    resetDb();
    queueRows([]);
    await getHourlyStatsAnalytics(SITE, { days: "365" });
    expect(windowDays()).toBe(7);
  });

  it("honours a window inside the clamp", async () => {
    queueRows([]);
    await getHourlyStatsAnalytics(SITE, { days: "3" });
    expect(windowDays()).toBe(3);
  });

  it("sanitises the timezone", async () => {
    queueRows([]);
    await getHourlyStatsAnalytics(SITE, { timezone: "Nope/Nowhere" });
    expect(boundTimezone()).toBe("UTC");
  });

  it("emits no timestamp field — a bucket spans several days", async () => {
    queueRows([{ h: 5, views: 1, unique: 1 }]);
    const out = await getHourlyStatsAnalytics(SITE, {});
    expect(out.hourly_stats[0]).not.toHaveProperty("timestamp");
  });

  it("returns only the hours that had traffic — the client scaffolds the rest", async () => {
    queueRows([{ h: 5, views: 1, unique: 1 }]);
    const out = await getHourlyStatsAnalytics(SITE, {});
    expect(out.hourly_stats).toHaveLength(1);
  });
});

// ─── Visitor insights ────────────────────────────────────────────────────────

describe("getVisitorInsightsAnalytics", () => {
  function insightRow(over: Record<string, unknown> = {}) {
    queueRows([
      {
        top_entry_pages: null,
        top_exit_pages: null,
        new_visitors: 0,
        returning_visitors: 0,
        ...over,
      },
    ]);
  }

  it("nests everything under visitor_insights", async () => {
    insightRow({ new_visitors: 70, returning_visitors: 30 });
    const out = await getVisitorInsightsAnalytics(SITE, {});
    expect(out.website_id).toBe(SITE);
    expect(out.visitor_insights.new_visitors).toBe(70);
    expect(out.visitor_insights.returning_visitors).toBe(30);
  });

  it("keeps new and returning as counts, not a normalised split", async () => {
    // The client derives the ratio; pre-normalising would lose the population size.
    insightRow({ new_visitors: 3, returning_visitors: 1 });
    const vi = (await getVisitorInsightsAnalytics(SITE, {})).visitor_insights;
    expect(vi.new_visitors + vi.returning_visitors).toBe(4);
  });

  it("projects entry and exit pages with a `sessions` count", async () => {
    insightRow({
      top_entry_pages: [{ page: "/", sessions: 40 }],
      top_exit_pages: [{ page: "/pricing", sessions: 15 }],
    });
    const vi = (await getVisitorInsightsAnalytics(SITE, {})).visitor_insights;
    expect(vi.top_entry_pages).toEqual([{ page: "/", sessions: 40 }]);
    expect(vi.top_exit_pages).toEqual([{ page: "/pricing", sessions: 15 }]);
  });

  it("turns a null aggregate into an empty list", async () => {
    // `json_agg` over no rows is NULL, not '[]' — leaving it would crash any `.map`.
    insightRow();
    const vi = (await getVisitorInsightsAnalytics(SITE, {})).visitor_insights;
    expect(vi.top_entry_pages).toEqual([]);
    expect(vi.top_exit_pages).toEqual([]);
  });

  it("survives a query that returns no row", async () => {
    queueRows([]);
    const vi = (await getVisitorInsightsAnalytics(SITE, {})).visitor_insights;
    expect(vi).toEqual({
      new_visitors: 0,
      returning_visitors: 0,
      top_entry_pages: [],
      top_exit_pages: [],
    });
  });

  it("coerces null session counts to zero", async () => {
    insightRow({ top_entry_pages: [{ page: "/", sessions: null }] });
    const vi = (await getVisitorInsightsAnalytics(SITE, {})).visitor_insights;
    expect(vi.top_entry_pages[0].sessions).toBe(0);
  });

  it("looks back no more than a year when classifying returning visitors", async () => {
    insightRow();
    await getVisitorInsightsAnalytics(SITE, { days: "7" });

    const isos = sqlCalls[0]!.values
      .filter((v): v is string => typeof v === "string" && v.endsWith("Z"))
      .map((s) => new Date(s).getTime())
      .sort((a, b) => a - b);
    const lookbackDays = (Date.now() - isos[0]!) / 86_400_000;
    // 365 days before the window start, which is itself 7 days back.
    expect(Math.round(lookbackDays)).toBe(372);
  });
});

// ─── Path analysis ───────────────────────────────────────────────────────────

describe("getPathAnalysisAnalytics", () => {
  it("projects the first three pages of a session with a session count", async () => {
    queueRows([{ page_1: "/", page_2: "/pricing", page_3: "/signup", sessions: 12 }]);
    expect(await getPathAnalysisAnalytics(SITE, {})).toEqual({
      website_id: SITE,
      date_range: "7d",
      paths: [{ page_1: "/", page_2: "/pricing", page_3: "/signup", sessions: 12 }],
    });
  });

  it("keeps a short journey's missing steps as null rather than dropping the row", async () => {
    // A one-page session is the most common path there is; collapsing it would erase
    // the single largest bar in the report.
    queueRows([{ page_1: "/", page_2: null, page_3: null, sessions: 40 }]);
    const out = await getPathAnalysisAnalytics(SITE, {});
    expect(out.paths[0]).toEqual({ page_1: "/", page_2: null, page_3: null, sessions: 40 });
  });

  it("normalises an undefined step to null", async () => {
    queueRows([{ page_1: "/", sessions: 5 }]);
    const out = await getPathAnalysisAnalytics(SITE, {});
    expect(out.paths[0].page_2).toBeNull();
    expect(out.paths[0].page_3).toBeNull();
  });

  it("defaults to a seven-day window and tolerates a missing query bag", async () => {
    queueRows([]);
    const out = await getPathAnalysisAnalytics(SITE);
    expect(out.date_range).toBe("7d");
    expect(windowDays()).toBe(7);
  });

  it("returns an empty path list for a site with no sessions", async () => {
    queueRows([]);
    expect((await getPathAnalysisAnalytics(SITE, {})).paths).toEqual([]);
  });
});

// ─── Custom events ───────────────────────────────────────────────────────────

describe("getCustomEventsAnalytics", () => {
  /** Events, then UTM sources, mediums, campaigns. */
  function eventRows(events: unknown[] = [], src: unknown[] = [], med: unknown[] = [], camp: unknown[] = []) {
    queueRows(events, src, med, camp);
  }

  it("issues one query per aggregate", async () => {
    eventRows();
    await getCustomEventsAnalytics(SITE, {});
    expect(sqlCalls).toHaveLength(4);
  });

  it("publishes the same event list under both `events` and `top_events`", async () => {
    eventRows([{ event_type: "signup", c: 12, unique_visitors: 9, unique_sessions: 10 }]);
    const out = await getCustomEventsAnalytics(SITE, {});
    expect(out.events).toEqual(out.top_events);
    expect(out.events[0]).toMatchObject({
      event_type: "signup",
      count: 12,
      unique_visitors: 9,
      unique_sessions: 10,
    });
  });

  it("counts total_occurrences as the sum of every event's count", async () => {
    eventRows([
      { event_type: "signup", c: 12, unique_visitors: 9, unique_sessions: 10 },
      { event_type: "purchase", c: 3, unique_visitors: 3, unique_sessions: 3 },
    ]);
    expect((await getCustomEventsAnalytics(SITE, {})).total_occurrences).toBe(15);
  });

  it("counts total_events as the number of distinct event types", async () => {
    // Named `total_events` but it is a cardinality, not a volume — `total_occurrences`
    // is the volume. Both are on the wire, so both are pinned.
    eventRows([
      { event_type: "signup", c: 12, unique_visitors: 9, unique_sessions: 10 },
      { event_type: "purchase", c: 3, unique_visitors: 3, unique_sessions: 3 },
    ]);
    const out = await getCustomEventsAnalytics(SITE, {});
    expect(out.total_events).toBe(2);
    expect(out.total_events).not.toBe(out.total_occurrences);
  });

  it("labels each UTM breakdown with its own key", async () => {
    eventRows(
      [],
      [{ label: "newsletter", visits: 10, unique_visitors: 7 }],
      [{ label: "email", visits: 8, unique_visitors: 6 }],
      [{ label: "spring", visits: 4, unique_visitors: 4 }],
    );
    const utm = (await getCustomEventsAnalytics(SITE, {})).utm_performance;
    expect(utm.sources).toEqual([{ source: "newsletter", visits: 10, unique_visitors: 7 }]);
    expect(utm.mediums).toEqual([{ medium: "email", visits: 8, unique_visitors: 6 }]);
    expect(utm.campaigns).toEqual([{ campaign: "spring", visits: 4, unique_visitors: 4 }]);
  });

  it("reports each UTM dimension's cardinality", async () => {
    eventRows(
      [],
      [
        { label: "a", visits: 1, unique_visitors: 1 },
        { label: "b", visits: 1, unique_visitors: 1 },
      ],
      [{ label: "email", visits: 1, unique_visitors: 1 }],
      [],
    );
    const utm = (await getCustomEventsAnalytics(SITE, {})).utm_performance;
    expect(utm.total_sources).toBe(2);
    expect(utm.total_mediums).toBe(1);
    expect(utm.total_campaigns).toBe(0);
  });

  it("keeps the not-yet-derived fields present so the shape stays stable", async () => {
    eventRows();
    const out = await getCustomEventsAnalytics(SITE, {});
    expect(out.utm_performance.terms).toEqual([]);
    expect(out.utm_performance.content).toEqual([]);
    expect(out.utm_performance.avg_ctr).toBe(0);
  });

  it("returns a fully-formed empty payload for a site with no events", async () => {
    eventRows();
    const out = await getCustomEventsAnalytics(SITE, {});
    expect(out.events).toEqual([]);
    expect(out.total_events).toBe(0);
    expect(out.total_occurrences).toBe(0);
    expect(out.utm_performance.sources).toEqual([]);
  });

  it("coerces null UTM counts to zero", async () => {
    eventRows([], [{ label: "x", visits: null, unique_visitors: null }]);
    const utm = (await getCustomEventsAnalytics(SITE, {})).utm_performance;
    expect(utm.sources[0]).toEqual({ source: "x", visits: 0, unique_visitors: 0 });
  });
});

// ─── Export ──────────────────────────────────────────────────────────────────

describe("getExportAnalytics", () => {
  const row = {
    event_type: "pageview",
    page: "/pricing",
    visitor_id: "v1",
    session_id: "s1",
    referrer: "https://google.com",
    country: "US",
    city: "Austin",
    browser: "Chrome",
    device: "desktop",
    os: "macOS",
    language: "en-US",
    utm_source: "newsletter",
    utm_medium: "email",
    utm_campaign: "spring",
    screen_width: 1920,
    screen_height: 1080,
    occurred_at: "2026-03-01T10:00:00.000Z",
  };

  it("reports the row count alongside the rows", async () => {
    queueRows([row, { ...row, page: "/" }]);
    const out = await getExportAnalytics(SITE, {});
    expect(out.total).toBe(2);
    expect(out.data).toHaveLength(2);
    expect(out.format).toBe("json");
  });

  it("emits every column the extract promises", async () => {
    queueRows([row]);
    const out = await getExportAnalytics(SITE, {});
    expect(Object.keys(out.data[0]).sort()).toEqual(
      [
        "browser",
        "city",
        "country",
        "device",
        "event_type",
        "language",
        "occurred_at",
        "os",
        "page",
        "referrer",
        "screen_height",
        "screen_width",
        "session_id",
        "utm_campaign",
        "utm_medium",
        "utm_source",
        "visitor_id",
      ].sort(),
    );
  });

  it("normalises the timestamp to ISO", async () => {
    queueRows([{ ...row, occurred_at: "2026-03-01 10:00:00+00" }]);
    const out = await getExportAnalytics(SITE, {});
    expect(out.data[0].occurred_at).toBe("2026-03-01T10:00:00.000Z");
  });

  it("preserves nulls rather than substituting placeholders", async () => {
    // An export feeds someone else's pipeline; "(not set)" would be indistinguishable
    // from a literal value in their data.
    queueRows([{ ...row, country: null, utm_source: null, screen_width: null }]);
    const out = await getExportAnalytics(SITE, {});
    expect(out.data[0].country).toBeNull();
    expect(out.data[0].utm_source).toBeNull();
    expect(out.data[0].screen_width).toBeNull();
  });

  it("defaults to a thirty-day window and tolerates a missing query bag", async () => {
    queueRows([]);
    const out = await getExportAnalytics(SITE);
    expect(out.date_range).toBe("30d");
    expect(windowDays()).toBe(30);
  });

  it("includes every event type, not just pageviews", async () => {
    queueRows([{ ...row, event_type: "purchase" }]);
    const out = await getExportAnalytics(SITE, {});
    expect(out.data[0].event_type).toBe("purchase");
  });

  it("returns an empty extract with a zero total", async () => {
    queueRows([]);
    const out = await getExportAnalytics(SITE, {});
    expect(out.total).toBe(0);
    expect(out.data).toEqual([]);
  });
});
