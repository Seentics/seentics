import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "./helpers/fake-db";

/**
 * The headline KPI surfaces: dashboard, traffic summary, goals.
 *
 * These are the three repositories that do real arithmetic after the query returns, so
 * they are tested by feeding the fake driver known aggregate rows and asserting the
 * derived numbers exactly — period-over-period deltas, pages-per-session, conversion
 * rate. Rounding is pinned to the digit because these values are rendered directly.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

let getDashboardStats: typeof import("../repositories/dashboard.repository").getDashboardStats;
let getTrafficSummaryStats: typeof import("../repositories/traffic-summary.repository").getTrafficSummaryStats;
let getGoalsStats: typeof import("../repositories/goals.repository").getGoalsStats;

beforeAll(async () => {
  ({ getDashboardStats } = await import("../repositories/dashboard.repository"));
  ({ getTrafficSummaryStats } = await import("../repositories/traffic-summary.repository"));
  ({ getGoalsStats } = await import("../repositories/goals.repository"));
});

beforeEach(resetDb);

const SITE = "site_1";

// ─── Dashboard ───────────────────────────────────────────────────────────────

/** The three result sets `getDashboardStats` consumes, in the order it issues them. */
function dashboardRows(
  agg: Partial<{ pv: number; uv: number; prev_pv: number; prev_uv: number }> = {},
  sess: Partial<{
    session_cnt: number;
    avg_session_sec: number;
    bounce_pct: number;
    prev_session_cnt: number;
    prev_avg_session_sec: number;
    prev_bounce_pct: number;
  }> = {},
  live = 0,
) {
  queueRows(
    [{ pv: 0, uv: 0, prev_pv: 0, prev_uv: 0, ...agg }],
    [
      {
        session_cnt: 0,
        avg_session_sec: 0,
        bounce_pct: 0,
        prev_session_cnt: 0,
        prev_avg_session_sec: 0,
        prev_bounce_pct: 0,
        ...sess,
      },
    ],
    [{ c: live }],
  );
}

describe("getDashboardStats", () => {
  it("issues exactly three queries — the aggregate, the session pass, and the live count", async () => {
    dashboardRows();
    await getDashboardStats(SITE, {});
    expect(sqlCalls).toHaveLength(3);
  });

  it("scopes every query to the website it was given", async () => {
    dashboardRows();
    await getDashboardStats(SITE, {});
    for (const call of sqlCalls) {
      expect(call.values).toContain(SITE);
    }
  });

  it("reports the window as the clamped day count, not the raw parameter", async () => {
    // A stale dashboard URL carrying days=99999 must render the default range and say
    // so — labelling it "99999d" would describe a window the query never used.
    dashboardRows();
    expect((await getDashboardStats(SITE, { days: "99999" })).date_range).toBe("7d");

    resetDb();
    dashboardRows();
    expect((await getDashboardStats(SITE, { days: "30" })).date_range).toBe("30d");

    resetDb();
    dashboardRows();
    expect((await getDashboardStats(SITE, {})).date_range).toBe("7d");
  });

  it("bounds the comparison window at exactly one prior period", async () => {
    dashboardRows();
    await getDashboardStats(SITE, { days: "7" });

    // The three bounds appear many times each across the FILTER clauses, so dedupe
    // before checking the spacing between them.
    const times = [
      ...new Set(
        sqlCalls[0]!.values
          .filter((v): v is string => typeof v === "string" && v.endsWith("Z"))
          .map((s) => new Date(s).getTime()),
      ),
    ].sort((a, b) => a - b);

    expect(times).toHaveLength(3);
    const [prevStart, start, end] = times as [number, number, number];

    const day = 86_400_000;
    // start − prevStart and end − start must both be the requested window, so the
    // comparison covers exactly one prior period rather than an overlapping range.
    expect(Math.round((start - prevStart) / day)).toBe(7);
    expect(Math.round((end - start) / day)).toBe(7);
  });

  it("copies the aggregate counts onto the top-level fields", async () => {
    dashboardRows({ pv: 500, uv: 120 }, { session_cnt: 200, avg_session_sec: 184, bounce_pct: 42.5 }, 12);
    const out = await getDashboardStats(SITE, {});

    expect(out.page_views).toBe(500);
    expect(out.unique_visitors).toBe(120);
    expect(out.sessions).toBe(200);
    expect(out.session_duration).toBe(184);
    expect(out.bounce_rate).toBe(42.5);
    expect(out.live_visitors).toBe(12);
    expect(out.website_id).toBe(SITE);
  });

  it("mirrors the same numbers into metrics and comparison.current_period", async () => {
    // Three copies of every KPI is a wire contract the dashboard reads from all three
    // places; they must never disagree, which is exactly what a partial edit here causes.
    dashboardRows({ pv: 500, uv: 120 }, { session_cnt: 200, avg_session_sec: 184, bounce_pct: 42.5 });
    const out = await getDashboardStats(SITE, {});

    expect(out.metrics).toMatchObject({
      page_views: out.page_views,
      unique_visitors: out.unique_visitors,
      sessions: out.sessions,
      bounce_rate: out.bounce_rate,
      avg_session_time: out.session_duration,
    });
    expect(out.comparison.current_period).toEqual({
      total_visitors: out.unique_visitors,
      unique_visitors: out.unique_visitors,
      page_views: out.page_views,
      sessions: out.sessions,
      bounce_rate: out.bounce_rate,
      avg_session_time: out.session_duration,
    });
  });

  it("reports total_visitors as the distinct-people count, matching unique_visitors", async () => {
    dashboardRows({ pv: 500, uv: 120 }, { session_cnt: 200 });
    const out = await getDashboardStats(SITE, {});
    expect(out.total_visitors).toBe(120);
    expect(out.total_visitors).toBe(out.unique_visitors);
  });

  describe("pages per session", () => {
    it("divides pageviews by sessions and rounds to two decimals", async () => {
      dashboardRows({ pv: 500 }, { session_cnt: 200 });
      expect((await getDashboardStats(SITE, {})).metrics.pages_per_session).toBe(2.5);
    });

    it("rounds rather than truncates", async () => {
      // 10/3 = 3.3333… must land on 3.33, and 20/3 = 6.6666… on 6.67.
      dashboardRows({ pv: 10 }, { session_cnt: 3 });
      expect((await getDashboardStats(SITE, {})).metrics.pages_per_session).toBe(3.33);

      resetDb();
      dashboardRows({ pv: 20 }, { session_cnt: 3 });
      expect((await getDashboardStats(SITE, {})).metrics.pages_per_session).toBe(6.67);
    });

    it("is zero rather than Infinity when there are no sessions", async () => {
      dashboardRows({ pv: 40 }, { session_cnt: 0 });
      const out = await getDashboardStats(SITE, {});
      expect(out.metrics.pages_per_session).toBe(0);
      expect(Number.isFinite(out.metrics.pages_per_session)).toBe(true);
    });
  });

  describe("period-over-period change", () => {
    it("computes each rate as a percentage of the prior period", async () => {
      dashboardRows(
        { pv: 150, uv: 120, prev_pv: 100, prev_uv: 100 },
        { session_cnt: 90, prev_session_cnt: 100 },
      );
      const cmp = (await getDashboardStats(SITE, {})).comparison;

      expect(cmp.pageview_change).toBeCloseTo(50, 10);
      expect(cmp.visitor_change).toBeCloseTo(20, 10);
      expect(cmp.session_change).toBeCloseTo(-10, 10);
    });

    it("reports duration change as a percentage, guarded on a non-zero prior", async () => {
      dashboardRows({}, { avg_session_sec: 120, prev_avg_session_sec: 100 });
      expect((await getDashboardStats(SITE, {})).comparison.duration_change).toBeCloseTo(20, 10);

      resetDb();
      dashboardRows({}, { avg_session_sec: 120, prev_avg_session_sec: 0 });
      expect((await getDashboardStats(SITE, {})).comparison.duration_change).toBe(0);
    });

    it("reports bounce change as a percentage-point delta, not a ratio", async () => {
      // Bounce rate is already a percentage. 40% → 50% is +10 points, not +25%.
      dashboardRows({}, { bounce_pct: 50, prev_bounce_pct: 40 });
      expect((await getDashboardStats(SITE, {})).comparison.bounce_change).toBeCloseTo(10, 10);
    });

    it("keeps the sign of a bounce-rate improvement negative", async () => {
      dashboardRows({}, { bounce_pct: 30, prev_bounce_pct: 45 });
      expect((await getDashboardStats(SITE, {})).comparison.bounce_change).toBeCloseTo(-15, 10);
    });

    it("returns 0 rather than Infinity when the prior period is empty", async () => {
      // Growth from zero is undefined; the dashboard renders it from previous_period
      // instead, so the change fields must stay finite rather than becoming Infinity or NaN.
      dashboardRows({ pv: 500, uv: 120, prev_pv: 0, prev_uv: 0 }, { session_cnt: 90, prev_session_cnt: 0 });
      const cmp = (await getDashboardStats(SITE, {})).comparison;

      for (const v of [cmp.visitor_change, cmp.pageview_change, cmp.session_change, cmp.duration_change]) {
        expect(v).toBe(0);
        expect(Number.isFinite(v)).toBe(true);
      }
    });

    it("exposes the prior period's raw figures so the client can render its own delta", async () => {
      dashboardRows(
        { prev_pv: 100, prev_uv: 80 },
        { prev_session_cnt: 70, prev_avg_session_sec: 95, prev_bounce_pct: 44.4 },
      );
      expect((await getDashboardStats(SITE, {})).comparison.previous_period).toEqual({
        total_visitors: 80,
        unique_visitors: 80,
        page_views: 100,
        sessions: 70,
        bounce_rate: 44.4,
        avg_session_time: 95,
      });
    });
  });

  it("returns zeroes rather than throwing when the aggregate query yields no row", async () => {
    queueRows([], [], []);
    const out = await getDashboardStats(SITE, {});
    expect(out.page_views).toBe(0);
    expect(out.unique_visitors).toBe(0);
    expect(out.sessions).toBe(0);
    expect(out.live_visitors).toBe(0);
    expect(out.metrics.pages_per_session).toBe(0);
    expect(out.comparison.visitor_change).toBe(0);
  });

  it("coerces string counts from the driver into numbers", async () => {
    // `postgres` returns bigint-typed columns as strings; a string reaching the client
    // turns "+" into concatenation in any downstream arithmetic.
    queueRows(
      [{ pv: "500", uv: "120", prev_pv: "100", prev_uv: "100" }],
      [{ session_cnt: "200", avg_session_sec: "184", bounce_pct: "42.5" }],
      [{ c: "12" }],
    );
    const out = await getDashboardStats(SITE, {});
    expect(out.page_views).toBe(500);
    expect(out.live_visitors).toBe(12);
    expect(out.metrics.pages_per_session).toBe(2.5);
    expect(out.comparison.pageview_change).toBeCloseTo(400, 10);
  });

  it("counts live visitors over a 30-second window independent of the report range", async () => {
    dashboardRows({}, {}, 12);
    await getDashboardStats(SITE, { days: "365" });

    const liveCall = sqlCalls[2]!;
    const since = liveCall.values.find(
      (v): v is string => typeof v === "string" && v.endsWith("Z"),
    )!;
    // 30 seconds back, whatever the report range — a 365-day request must not widen
    // the "who is here right now" badge into a year-long count.
    const age = Date.now() - new Date(since).getTime();
    expect(age).toBeGreaterThanOrEqual(30_000);
    expect(age).toBeLessThan(31_000);
  });
});

// ─── Traffic summary ─────────────────────────────────────────────────────────

describe("getTrafficSummaryStats", () => {
  const channels = [
    { channel: "direct", views: 10, unique_visitors: 5, total_visitors: 6 },
    { channel: "organic", views: 4, unique_visitors: 3, total_visitors: 6 },
  ];

  it("sums views across channels", async () => {
    queueRows(channels);
    expect((await getTrafficSummaryStats(SITE, {})).total_views).toBe(14);
  });

  it("takes total_visitors from the site-wide distinct count, not the per-channel sum", async () => {
    // The whole reason the query carries `total_visitors` on every row: a visitor who
    // arrived via two channels is counted once site-wide but twice in the column sum.
    // 5 + 3 = 8 would over-report by two people.
    queueRows(channels);
    const out = await getTrafficSummaryStats(SITE, {});
    expect(out.total_visitors).toBe(6);
    expect(out.total_visitors).not.toBe(8);
  });

  it("projects each channel without the redundant total column", async () => {
    queueRows(channels);
    expect((await getTrafficSummaryStats(SITE, {})).channels).toEqual([
      { channel: "direct", views: 10, unique_visitors: 5 },
      { channel: "organic", views: 4, unique_visitors: 3 },
    ]);
  });

  it("preserves the query's ordering rather than re-sorting", async () => {
    queueRows([
      { channel: "social", views: 1, unique_visitors: 1, total_visitors: 9 },
      { channel: "direct", views: 100, unique_visitors: 9, total_visitors: 9 },
    ]);
    expect((await getTrafficSummaryStats(SITE, {})).channels.map((c) => c.channel)).toEqual([
      "social",
      "direct",
    ]);
  });

  it("returns an empty summary for a site with no traffic", async () => {
    queueRows([]);
    expect(await getTrafficSummaryStats(SITE, {})).toEqual({
      website_id: SITE,
      date_range: "7d",
      channels: [],
      total_views: 0,
      total_visitors: 0,
    });
  });

  it("coerces string counts before summing", async () => {
    queueRows([
      { channel: "direct", views: "10", unique_visitors: "5", total_visitors: "6" },
      { channel: "organic", views: "4", unique_visitors: "3", total_visitors: "6" },
    ]);
    const out = await getTrafficSummaryStats(SITE, {});
    expect(out.total_views).toBe(14);
    expect(out.total_views).not.toBe("104");
  });

  it("anchors the social and search patterns to the referrer host", async () => {
    // The patterns are passed as binds. `x.com` must not match `wix.com`, and a
    // `google` path segment must not count as organic search.
    queueRows([]);
    await getTrafficSummaryStats(SITE, {});
    const [social, search] = sqlCalls[0]!.values.filter(
      (v): v is string => typeof v === "string" && v.startsWith("^https?://"),
    );

    expect(new RegExp(social!, "i").test("https://x.com/post")).toBe(true);
    expect(new RegExp(social!, "i").test("https://wix.com/x")).toBe(false);
    expect(new RegExp(social!, "i").test("https://www.facebook.com")).toBe(true);
    expect(new RegExp(search!, "i").test("https://www.google.com/search")).toBe(true);
    expect(new RegExp(search!, "i").test("https://example.com/google/thing")).toBe(false);
  });
});

// ─── Goals ───────────────────────────────────────────────────────────────────

describe("getGoalsStats", () => {
  function goalRows(siteUv: number, goals: Array<Record<string, unknown>>) {
    queueRows([{ uv: siteUv }], goals);
  }

  it("expresses conversion rate as a percentage of site-wide unique visitors", async () => {
    // Not a percentage of completions: a goal hit twice by one person converts one
    // visitor, and the denominator is everybody who visited in the window.
    goalRows(200, [
      { id: "g1", name: "Signup", goal_type: "event", target: "signup", completions: 60, unique_visitors: 50 },
    ]);
    const out = await getGoalsStats(SITE, {});
    expect(out.goals[0]!.conversion_rate).toBe(25);
    expect(out.goals[0]!.completions).toBe(60);
    expect(out.goals[0]!.unique_visitors).toBe(50);
  });

  it("rounds the rate to one decimal place", async () => {
    goalRows(3, [{ id: "g1", name: "G", goal_type: "event", target: "t", completions: 1, unique_visitors: 1 }]);
    // 1/3 = 33.333…% → 33.3
    expect((await getGoalsStats(SITE, {})).goals[0]!.conversion_rate).toBe(33.3);

    resetDb();
    goalRows(7, [{ id: "g1", name: "G", goal_type: "event", target: "t", completions: 2, unique_visitors: 2 }]);
    // 2/7 = 28.571…% → 28.6
    expect((await getGoalsStats(SITE, {})).goals[0]!.conversion_rate).toBe(28.6);
  });

  it("reports 100% when every visitor converted", async () => {
    goalRows(40, [{ id: "g1", name: "G", goal_type: "event", target: "t", completions: 40, unique_visitors: 40 }]);
    expect((await getGoalsStats(SITE, {})).goals[0]!.conversion_rate).toBe(100);
  });

  it("returns 0 rather than NaN when the site had no visitors", async () => {
    goalRows(0, [{ id: "g1", name: "G", goal_type: "event", target: "t", completions: 0, unique_visitors: 0 }]);
    const rate = (await getGoalsStats(SITE, {})).goals[0]!.conversion_rate;
    expect(rate).toBe(0);
    expect(Number.isNaN(rate)).toBe(false);
  });

  it("keeps a goal with no conversions in the list", async () => {
    // Dropping it would make a misconfigured goal look deleted rather than unconverted.
    goalRows(100, [
      { id: "g1", name: "Never", goal_type: "pageview", target: "/thanks", completions: 0, unique_visitors: 0 },
    ]);
    const out = await getGoalsStats(SITE, {});
    expect(out.goals).toHaveLength(1);
    expect(out.goals[0]).toEqual({
      id: "g1",
      name: "Never",
      goal_type: "pageview",
      target: "/thanks",
      completions: 0,
      unique_visitors: 0,
      conversion_rate: 0,
    });
  });

  it("preserves the query's goal ordering", async () => {
    goalRows(10, [
      { id: "b", name: "B", goal_type: "event", target: "b", completions: 1, unique_visitors: 1 },
      { id: "a", name: "A", goal_type: "event", target: "a", completions: 9, unique_visitors: 9 },
    ]);
    expect((await getGoalsStats(SITE, {})).goals.map((g) => g.id)).toEqual(["b", "a"]);
  });

  it("coerces null counts to zero", async () => {
    goalRows(10, [
      { id: "g1", name: "G", goal_type: "event", target: "t", completions: null, unique_visitors: null },
    ]);
    const goal = (await getGoalsStats(SITE, {})).goals[0]!;
    expect(goal.completions).toBe(0);
    expect(goal.unique_visitors).toBe(0);
    expect(goal.conversion_rate).toBe(0);
  });

  it("labels the window with the clamped day count", async () => {
    goalRows(0, []);
    expect((await getGoalsStats(SITE, { days: "0" })).date_range).toBe("7d");
  });
});
