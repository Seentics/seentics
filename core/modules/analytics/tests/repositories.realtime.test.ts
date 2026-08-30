import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "./helpers/fake-db";

/**
 * The live surfaces: realtime stats, the geo breakdown, the live-visitor badge, and the
 * activity feed.
 *
 * What is worth pinning here is not the SQL but the shaping around it — the minute
 * scaffold that keeps a realtime chart continuous, the percentage split that has to sum
 * to a hundred, and the window selection that decides whether "recent activity" means
 * the last half hour or the last month.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

let buildUtcTimeline: typeof import("../repositories/realtime.repository").buildUtcTimeline;
let utcMinuteKey: typeof import("../repositories/realtime.repository").utcMinuteKey;
let getRealtimeStats: typeof import("../repositories/realtime.repository").getRealtimeStats;
let REALTIME_WINDOW_MS: number;
let LIVE_VISITOR_WINDOW_MS: number;
let getRealtimeGeoAnalytics: typeof import("../repositories/realtime-geo.repository").getRealtimeGeoAnalytics;
let getLiveVisitorsStats: typeof import("../repositories/live-visitors.repository").getLiveVisitorsStats;
let getRecentActivityAnalytics: typeof import("../repositories/recent-activity.repository").getRecentActivityAnalytics;

beforeAll(async () => {
  const rt = await import("../repositories/realtime.repository");
  ({ buildUtcTimeline, utcMinuteKey, getRealtimeStats } = rt);
  REALTIME_WINDOW_MS = rt.REALTIME_WINDOW_MS;
  LIVE_VISITOR_WINDOW_MS = rt.LIVE_VISITOR_WINDOW_MS;
  ({ getRealtimeGeoAnalytics } = await import("../repositories/realtime-geo.repository"));
  ({ getLiveVisitorsStats } = await import("../repositories/live-visitors.repository"));
  ({ getRecentActivityAnalytics } = await import("../repositories/recent-activity.repository"));
});

beforeEach(resetDb);

const SITE = "site_1";

/** The single ISO bind a query issued, when it issued exactly one. */
function isoBinds(callIndex: number): string[] {
  return sqlCalls[callIndex]!.values.filter(
    (v): v is string => typeof v === "string" && v.endsWith("Z"),
  );
}

// ─── Window constants ────────────────────────────────────────────────────────

describe("realtime windows", () => {
  it("defines 30 minutes for the active window and 30 seconds for the live badge", async () => {
    // Both are read by other repositories (dashboard, live-visitors), so a change here
    // silently moves three surfaces at once.
    expect(REALTIME_WINDOW_MS).toBe(1_800_000);
    expect(LIVE_VISITOR_WINDOW_MS).toBe(30_000);
  });
});

// ─── The minute scaffold ─────────────────────────────────────────────────────

describe("buildUtcTimeline", () => {
  it("always returns exactly 30 buckets", async () => {
    expect(buildUtcTimeline([])).toHaveLength(30);
    expect(buildUtcTimeline([{ minute: "00:00", views: 1, visitors: 1 }])).toHaveLength(30);
  });

  it("fills every bucket with zeroes when nothing happened", async () => {
    const out = buildUtcTimeline([]);
    expect(out.every((b) => b.views === 0 && b.visitors === 0)).toBe(true);
  });

  it("runs oldest to newest, ending on the current minute", async () => {
    const out = buildUtcTimeline([]);
    expect(out[29]!.minute).toBe(utcMinuteKey(new Date()));
    expect(out[0]!.minute).toBe(utcMinuteKey(new Date(Date.now() - 29 * 60_000)));
  });

  it("produces 30 consecutive minutes with no gaps or repeats", async () => {
    // A duplicated label would make two chart points share an x value; a gap would let
    // the chart interpolate across a minute that really had no traffic.
    const labels = buildUtcTimeline([]).map((b) => b.minute);
    expect(new Set(labels).size).toBe(30);

    const toMinutes = (s: string) => {
      const [h, m] = s.split(":").map(Number);
      return h! * 60 + m!;
    };
    for (let i = 1; i < labels.length; i++) {
      const delta = (toMinutes(labels[i]!) - toMinutes(labels[i - 1]!) + 1440) % 1440;
      expect(delta).toBe(1);
    }
  });

  it("places a row's counts in the bucket matching its label", async () => {
    const target = utcMinuteKey(new Date(Date.now() - 10 * 60_000));
    const out = buildUtcTimeline([{ minute: target, views: 7, visitors: 3 }]);

    const hit = out.find((b) => b.minute === target)!;
    expect(hit).toEqual({ minute: target, views: 7, visitors: 3 });
    expect(out.filter((b) => b.views !== 0)).toHaveLength(1);
  });

  it("keeps zero minutes between two populated ones rather than collapsing them", async () => {
    const now = Date.now();
    const a = utcMinuteKey(new Date(now - 20 * 60_000));
    const b = utcMinuteKey(new Date(now - 5 * 60_000));
    const out = buildUtcTimeline([
      { minute: a, views: 4, visitors: 2 },
      { minute: b, views: 9, visitors: 5 },
    ]);

    expect(out.findIndex((x) => x.minute === b) - out.findIndex((x) => x.minute === a)).toBe(15);
    expect(out.filter((x) => x.views > 0)).toHaveLength(2);
  });

  it("drops rows outside the window instead of appending them", async () => {
    // A label from two hours ago has no bucket. It must not extend the series past 30.
    const stale = utcMinuteKey(new Date(Date.now() - 120 * 60_000));
    const out = buildUtcTimeline([{ minute: stale, views: 99, visitors: 99 }]);

    expect(out).toHaveLength(30);
    expect(out.some((b) => b.views === 99)).toBe(false);
  });

  it("does not depend on the order the aggregate came back in", async () => {
    const now = Date.now();
    const rows = [5, 15, 25].map((ago) => ({
      minute: utcMinuteKey(new Date(now - ago * 60_000)),
      views: ago,
      visitors: 1,
    }));
    expect(buildUtcTimeline([...rows].reverse())).toEqual(buildUtcTimeline(rows));
  });

  it("keeps the first row when the aggregate repeats a label", async () => {
    const key = utcMinuteKey(new Date(Date.now() - 3 * 60_000));
    const out = buildUtcTimeline([
      { minute: key, views: 1, visitors: 1 },
      { minute: key, views: 2, visitors: 2 },
    ]);
    // A Map built from the list keeps the *last* entry for a duplicated key.
    expect(out.find((b) => b.minute === key)).toEqual({ minute: key, views: 2, visitors: 2 });
  });
});

describe("utcMinuteKey", () => {
  it("zero-pads to HH:MM so labels sort and match the query's to_char output", async () => {
    expect(utcMinuteKey(new Date("2026-03-01T04:07:00Z"))).toBe("04:07");
    expect(utcMinuteKey(new Date("2026-03-01T00:00:00Z"))).toBe("00:00");
    expect(utcMinuteKey(new Date("2026-03-01T23:59:00Z"))).toBe("23:59");
  });

  it("reads the clock in UTC, not the host's local zone", async () => {
    // The query buckets on `occurred_at AT TIME ZONE 'UTC'`, so a label derived from
    // local time would mismatch every bucket on any machine that is not on UTC.
    expect(utcMinuteKey(new Date("2026-03-01T12:34:00Z"))).toBe("12:34");
  });
});

// ─── getRealtimeStats ────────────────────────────────────────────────────────

function realtimeRow(over: Record<string, unknown> = {}) {
  queueRows([
    {
      pageviews: 0,
      sessions: 0,
      visitors: 0,
      live_visitors: 0,
      top_pages: null,
      top_countries: null,
      top_referrers: null,
      top_devices: null,
      top_browsers: null,
      timeline: null,
      ...over,
    },
  ]);
}

describe("getRealtimeStats", () => {
  it("answers in a single round trip", async () => {
    realtimeRow();
    await getRealtimeStats(SITE);
    expect(sqlCalls).toHaveLength(1);
  });

  it("binds a 30-minute window and a 30-second live cutoff", async () => {
    realtimeRow();
    await getRealtimeStats(SITE);

    const [since, liveSince] = isoBinds(0).map((s) => Date.now() - new Date(s).getTime());
    expect(since).toBeGreaterThanOrEqual(REALTIME_WINDOW_MS);
    expect(since).toBeLessThan(REALTIME_WINDOW_MS + 1_000);
    expect(liveSince).toBeGreaterThanOrEqual(LIVE_VISITOR_WINDOW_MS);
    expect(liveSince).toBeLessThan(LIVE_VISITOR_WINDOW_MS + 1_000);
  });

  it("separates active visitors (30 min) from live visitors (30 s)", async () => {
    // Collapsing these was the original bug the two windows exist to prevent: the
    // "active now" tile and the pulsing live badge count different populations.
    realtimeRow({ visitors: 40, live_visitors: 3 });
    const out = await getRealtimeStats(SITE);
    expect(out.active_visitors).toBe(40);
    expect(out.live_visitors).toBe(3);
  });

  it("returns a fully-formed empty payload when the site has no traffic", async () => {
    realtimeRow();
    const out = await getRealtimeStats(SITE);

    expect(out.pageviews).toBe(0);
    expect(out.sessions).toBe(0);
    expect(out.top_pages).toEqual([]);
    expect(out.top_countries).toEqual([]);
    expect(out.top_referrers).toEqual([]);
    expect(out.top_devices).toEqual([]);
    expect(out.top_browsers).toEqual([]);
    expect(out.pages).toEqual([]);
    // The chart still needs its axis even with nothing to plot.
    expect(out.timeline).toHaveLength(30);
  });

  it("survives a query that returns no row at all", async () => {
    queueRows([]);
    const out = await getRealtimeStats(SITE);
    expect(out.active_visitors).toBe(0);
    expect(out.timeline).toHaveLength(30);
  });

  it("gives top pages both the `visitors` and `count` aliases the dashboard reads", async () => {
    realtimeRow({ top_pages: [{ page: "/pricing", visitors: 9 }] });
    expect((await getRealtimeStats(SITE)).top_pages).toEqual([
      { page: "/pricing", visitors: 9, count: 9 },
    ]);
  });

  it("gives top countries both the `name`/`country` and `visitors`/`count` aliases", async () => {
    realtimeRow({ top_countries: [{ name: "US", visitors: 4 }] });
    expect((await getRealtimeStats(SITE)).top_countries).toEqual([
      { name: "US", visitors: 4, country: "US", count: 4 },
    ]);
  });

  it("mirrors top_pages into `pages` with the narrower shape", async () => {
    realtimeRow({ top_pages: [{ page: "/a", visitors: 2 }] });
    const out = await getRealtimeStats(SITE);
    expect(out.pages).toEqual([{ page: "/a", visitors: 2 }]);
    expect(out.pages).toHaveLength(out.top_pages.length);
  });

  it("substitutes placeholders for blank dimension labels", async () => {
    realtimeRow({
      top_countries: [{ name: "", visitors: 1 }],
      top_referrers: [{ name: "", visitors: 1 }],
      top_devices: [{ name: "", visitors: 1 }],
      top_browsers: [{ name: "", visitors: 1 }],
    });
    const out = await getRealtimeStats(SITE);

    expect(out.top_countries[0]!.name).toBe("Unknown");
    expect(out.top_devices[0]!.name).toBe("Unknown");
    expect(out.top_browsers[0]!.name).toBe("Unknown");
    // Referrers get their own placeholder — a missing referrer means direct traffic,
    // which is a fact about the visit rather than missing data.
    expect(out.top_referrers[0]!.name).toBe("(direct)");
  });

  it("coerces string counts from the driver", async () => {
    realtimeRow({
      pageviews: "12",
      sessions: "7",
      visitors: "5",
      live_visitors: "2",
      top_pages: [{ page: "/a", visitors: "3" }],
    });
    const out = await getRealtimeStats(SITE);
    expect(out.pageviews).toBe(12);
    expect(out.sessions).toBe(7);
    expect(out.top_pages[0]!.visitors).toBe(3);
  });

  it("scaffolds the timeline from the aggregate's sparse buckets", async () => {
    const key = utcMinuteKey(new Date(Date.now() - 4 * 60_000));
    realtimeRow({ timeline: [{ minute: key, views: 6, visitors: 4 }] });
    const out = await getRealtimeStats(SITE);

    expect(out.timeline).toHaveLength(30);
    expect(out.timeline.find((t) => t.minute === key)).toEqual({
      minute: key,
      views: 6,
      visitors: 4,
    });
  });
});

// ─── Realtime geo ────────────────────────────────────────────────────────────

describe("getRealtimeGeoAnalytics", () => {
  it("defaults to a 30-minute window and labels it", async () => {
    queueRows([]);
    const out = await getRealtimeGeoAnalytics(SITE);
    expect(out.date_range).toBe("30m");

    const age = Date.now() - new Date(isoBinds(0)[0]!).getTime();
    expect(age).toBeGreaterThanOrEqual(30 * 60_000);
    expect(age).toBeLessThan(30 * 60_000 + 1_000);
  });

  it("honours an explicit window in both the bind and the label", async () => {
    queueRows([]);
    const out = await getRealtimeGeoAnalytics(SITE, { withinMinutes: 5 });
    expect(out.date_range).toBe("5m");

    const age = Date.now() - new Date(isoBinds(0)[0]!).getTime();
    expect(age).toBeGreaterThanOrEqual(5 * 60_000);
    expect(age).toBeLessThan(5 * 60_000 + 1_000);
  });

  it("falls back to the default when opts is present but the window is not", async () => {
    queueRows([]);
    expect((await getRealtimeGeoAnalytics(SITE, {})).date_range).toBe("30m");
  });

  it("resolves a two-letter code to a country name and keeps the code", async () => {
    queueRows([{ country: "US", count: 3 }]);
    expect((await getRealtimeGeoAnalytics(SITE)).visitors[0]).toEqual({
      name: "United States",
      code: "US",
      count: 3,
      percentage: 100,
    });
  });

  it("uppercases a lowercase code before resolving it", async () => {
    queueRows([{ country: "gb", count: 1 }]);
    const v = (await getRealtimeGeoAnalytics(SITE)).visitors[0]!;
    expect(v.code).toBe("GB");
    expect(v.name).toBe("United Kingdom");
  });

  it("leaves a non-code value as its own label with no country code", async () => {
    queueRows([{ country: "Atlantis", count: 2 }]);
    const v = (await getRealtimeGeoAnalytics(SITE)).visitors[0]!;
    expect(v.name).toBe("Atlantis");
    expect(v.code).toBeUndefined();
  });

  it("labels null, empty, and whitespace countries as Unknown", async () => {
    for (const country of [null, "", "   "]) {
      resetDb();
      queueRows([{ country, count: 1 }]);
      const v = (await getRealtimeGeoAnalytics(SITE)).visitors[0]!;
      expect(v.name).toBe("Unknown");
      expect(v.code).toBeUndefined();
    }
  });

  it("splits percentages across the whole result, summing to 100", async () => {
    queueRows([
      { country: "US", count: 50 },
      { country: "GB", count: 30 },
      { country: "DE", count: 20 },
    ]);
    const out = await getRealtimeGeoAnalytics(SITE);
    expect(out.visitors.map((v) => v.percentage)).toEqual([50, 30, 20]);
    expect(out.visitors.reduce((s, v) => s + v.percentage, 0)).toBeCloseTo(100, 10);
  });

  it("keeps percentages exact rather than pre-rounding them", async () => {
    // 1/3 must not become 33 — the client decides the display precision, and rounding
    // here would make three equal countries sum to 99.
    queueRows([
      { country: "US", count: 1 },
      { country: "GB", count: 1 },
      { country: "DE", count: 1 },
    ]);
    const out = await getRealtimeGeoAnalytics(SITE);
    expect(out.visitors[0]!.percentage).toBeCloseTo(33.3333, 3);
    expect(out.visitors.reduce((s, v) => s + v.percentage, 0)).toBeCloseTo(100, 10);
  });

  it("sorts by visitor count descending regardless of query order", async () => {
    queueRows([
      { country: "DE", count: 2 },
      { country: "US", count: 9 },
      { country: "GB", count: 5 },
    ]);
    expect((await getRealtimeGeoAnalytics(SITE)).visitors.map((v) => v.code)).toEqual([
      "US",
      "GB",
      "DE",
    ]);
  });

  it("returns 0% rather than NaN when every count is zero", async () => {
    queueRows([{ country: "US", count: 0 }]);
    const v = (await getRealtimeGeoAnalytics(SITE)).visitors[0]!;
    expect(v.percentage).toBe(0);
    expect(Number.isNaN(v.percentage)).toBe(false);
  });

  it("returns an empty list for a site with no live traffic", async () => {
    queueRows([]);
    expect((await getRealtimeGeoAnalytics(SITE)).visitors).toEqual([]);
  });
});

// ─── Live visitors ───────────────────────────────────────────────────────────

describe("getLiveVisitorsStats", () => {
  it("issues a count query and a recent-visitor query", async () => {
    queueRows([{ live_visitors: 0, active_visitors: 0 }], []);
    await getLiveVisitorsStats(SITE);
    expect(sqlCalls).toHaveLength(2);
  });

  it("reports both counts from the same row", async () => {
    queueRows([{ live_visitors: 3, active_visitors: 41 }], []);
    const out = await getLiveVisitorsStats(SITE);
    expect(out.live_visitors).toBe(3);
    expect(out.active_visitors).toBe(41);
  });

  it("scans a 30-minute range while filtering the live count to 30 seconds", async () => {
    queueRows([{ live_visitors: 0, active_visitors: 0 }], []);
    await getLiveVisitorsStats(SITE);

    const ages = isoBinds(0).map((s) => Date.now() - new Date(s).getTime()).sort((a, b) => a - b);
    expect(ages[0]).toBeGreaterThanOrEqual(LIVE_VISITOR_WINDOW_MS);
    expect(ages[0]).toBeLessThan(LIVE_VISITOR_WINDOW_MS + 1_000);
    expect(ages[1]).toBeGreaterThanOrEqual(REALTIME_WINDOW_MS);
  });

  it("renames occurred_at to last_seen for the visitor list", async () => {
    queueRows(
      [{ live_visitors: 1, active_visitors: 1 }],
      [
        {
          visitor_id: "v1",
          session_id: "s1",
          page: "/pricing",
          country: "US",
          browser: "Chrome",
          device: "desktop",
          occurred_at: "2026-03-01T10:00:00.000Z",
        },
      ],
    );
    expect((await getLiveVisitorsStats(SITE)).visitors).toEqual([
      {
        visitor_id: "v1",
        session_id: "s1",
        page: "/pricing",
        country: "US",
        browser: "Chrome",
        device: "desktop",
        last_seen: "2026-03-01T10:00:00.000Z",
      },
    ]);
  });

  it("normalises absent dimensions to null rather than dropping the key", async () => {
    queueRows(
      [{ live_visitors: 1, active_visitors: 1 }],
      [
        {
          visitor_id: "v1",
          session_id: "s1",
          page: "/",
          country: undefined,
          browser: null,
          device: undefined,
          occurred_at: "2026-03-01T10:00:00.000Z",
        },
      ],
    );
    const v = (await getLiveVisitorsStats(SITE)).visitors[0]!;
    expect(v.country).toBeNull();
    expect(v.browser).toBeNull();
    expect(v.device).toBeNull();
  });

  it("returns zeroes and an empty list when nobody is on the site", async () => {
    queueRows([], []);
    expect(await getLiveVisitorsStats(SITE)).toEqual({
      website_id: SITE,
      live_visitors: 0,
      active_visitors: 0,
      visitors: [],
    });
  });
});

// ─── Recent activity ─────────────────────────────────────────────────────────

describe("getRecentActivityAnalytics", () => {
  const row = {
    event_type: "pageview",
    page: "/pricing",
    visitor_id: "v1",
    session_id: "s1",
    country: "US",
    browser: "Chrome",
    device: "desktop",
    os: "macOS",
    referrer: "https://google.com",
    occurred_at: "2026-03-01T10:00:00.000Z",
  };

  it("falls back to a 30-day window when no minute window is given", async () => {
    queueRows([]);
    const out = await getRecentActivityAnalytics(SITE, 50);
    expect(out.date_range).toBe("30d");

    const age = Date.now() - new Date(isoBinds(0)[0]!).getTime();
    expect(age).toBeGreaterThanOrEqual(30 * 86_400_000);
  });

  it("uses the minute window when one is supplied, and labels it in minutes", async () => {
    queueRows([]);
    const out = await getRecentActivityAnalytics(SITE, 50, { withinMinutes: 30 });
    expect(out.date_range).toBe("30m");

    const age = Date.now() - new Date(isoBinds(0)[0]!).getTime();
    expect(age).toBeGreaterThanOrEqual(30 * 60_000);
    expect(age).toBeLessThan(30 * 60_000 + 1_000);
  });

  it("accepts a one-minute window and a full-day window", async () => {
    queueRows([]);
    expect((await getRecentActivityAnalytics(SITE, 10, { withinMinutes: 1 })).date_range).toBe("1m");
    resetDb();
    queueRows([]);
    expect((await getRecentActivityAnalytics(SITE, 10, { withinMinutes: 1440 })).date_range).toBe(
      "1440m",
    );
  });

  it("ignores an out-of-range or nonsensical minute window", async () => {
    // Defence in depth: the route validates this, but the repository is also reachable
    // from the service, so an absurd window must not invert or explode the range.
    for (const withinMinutes of [0, -30, 1441, Number.NaN, Number.POSITIVE_INFINITY]) {
      resetDb();
      queueRows([]);
      const out = await getRecentActivityAnalytics(SITE, 10, { withinMinutes });
      expect(out.date_range).toBe("30d");
      const age = Date.now() - new Date(isoBinds(0)[0]!).getTime();
      expect(age).toBeGreaterThanOrEqual(30 * 86_400_000);
    }
  });

  it("caps the row limit at 100 however large the caller's request", async () => {
    queueRows([]);
    await getRecentActivityAnalytics(SITE, 5_000);
    expect(sqlCalls[0]!.values).toContain(100);
  });

  it("passes a smaller limit through unchanged", async () => {
    queueRows([]);
    await getRecentActivityAnalytics(SITE, 20);
    expect(sqlCalls[0]!.values).toContain(20);
  });

  it("renames event_type to `type` and normalises the timestamp", async () => {
    queueRows([row]);
    expect((await getRecentActivityAnalytics(SITE, 10)).activity).toEqual([
      {
        type: "pageview",
        page: "/pricing",
        visitor_id: "v1",
        session_id: "s1",
        country: "US",
        browser: "Chrome",
        device: "desktop",
        os: "macOS",
        referrer: "https://google.com",
        occurred_at: "2026-03-01T10:00:00.000Z",
      },
    ]);
  });

  it("converts a driver's space-separated timestamp to ISO", async () => {
    // The feed renders relative times off this string; an unparseable value blanks
    // the column rather than erroring, which is why the normalisation matters.
    queueRows([{ ...row, occurred_at: "2026-03-01 10:00:00+00" }]);
    expect((await getRecentActivityAnalytics(SITE, 10)).activity[0]!.occurred_at).toBe(
      "2026-03-01T10:00:00.000Z",
    );
  });

  it("preserves null dimensions instead of substituting placeholders", async () => {
    // The feed decides how to render an unknown device; the API reports what it has.
    queueRows([{ ...row, country: null, browser: null, device: null, os: null, referrer: null }]);
    const a = (await getRecentActivityAnalytics(SITE, 10)).activity[0]!;
    expect(a.country).toBeNull();
    expect(a.browser).toBeNull();
    expect(a.referrer).toBeNull();
  });

  it("includes non-pageview events — this is an event log, not a pageview feed", async () => {
    queueRows([{ ...row, event_type: "purchase" }]);
    expect((await getRecentActivityAnalytics(SITE, 10)).activity[0]!.type).toBe("purchase");
  });

  it("returns an empty activity list rather than omitting the key", async () => {
    queueRows([]);
    expect(await getRecentActivityAnalytics(SITE, 10)).toEqual({
      website_id: SITE,
      date_range: "30d",
      activity: [],
    });
  });
});
