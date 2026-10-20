import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "./helpers/fake-db";

/**
 * The dashboard's filters, from query string to SQL.
 *
 * They used to stop at `parseAnalyticsQuery`, which kept only the range and timezone, so a
 * filtered dashboard rendered unfiltered numbers. What is pinned here: the filters reach the
 * reads, every value is a bound parameter (never SQL text), a property key has to look like
 * one, and a filtered read is computed from raw events even when the rollups exist — they
 * hold one dimension at a time and cannot answer it.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);

/* eslint-disable @typescript-eslint/no-explicit-any */
let parseFilters: typeof import("../lib/analytics-filters").parseFilters;
let filterSql: typeof import("../lib/filter-sql").filterSql;
let parseAnalyticsQuery: typeof import("../lib/analytics-query").parseAnalyticsQuery;
let setRollupsEnabled: (v: boolean) => void;
let getDashboardStats: any;
let getDimensionsBulkAnalytics: any;
let getDailyStatsAnalytics: any;

beforeAll(async () => {
  ({ parseFilters } = await import("../lib/analytics-filters"));
  ({ filterSql } = await import("../lib/filter-sql"));
  ({ parseAnalyticsQuery } = await import("../lib/analytics-query"));
  ({ setRollupsEnabled } = await import("../rollups/reads"));
  ({ getDashboardStats } = await import("../repositories/dashboard.repository"));
  ({ getDimensionsBulkAnalytics } = await import("../repositories/dimensions-bulk.repository"));
  ({ getDailyStatsAnalytics } = await import("../repositories/daily-stats.repository"));
});

beforeEach(resetDb);
afterEach(() => setRollupsEnabled(false));

const SITE = "site_1";
const bounds = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };

describe("parseAnalyticsQuery", () => {
  it("keeps the filters and the explicit range, which it used to drop", () => {
    const q: Record<string, string> = {
      days: "7", from: "2026-10-01", to: "2026-10-07", timezone: "UTC",
      country: "US", device: "Mobile", browser: "Chrome", os: "iOS",
      utm_source: "news", utm_medium: "email", utm_campaign: "launch",
      page_path: "/pricing", prop_key: "plan", prop_value: "pro",
      secret: "nope",
    };
    const out = parseAnalyticsQuery((k) => q[k]);
    const { secret: _, ...kept } = q;
    expect(out).toMatchObject(kept);
    expect("secret" in out).toBe(false);
  });
});

describe("parseFilters", () => {
  it("normalises the country to its stored ISO code and drops anything else", () => {
    expect(parseFilters({ country: "us" }).country).toBe("US");
    expect(parseFilters({ country: "United States" }).country).toBeUndefined();
  });

  it("drops blank and over-long values", () => {
    expect(parseFilters({ device: "  ", os: "x".repeat(300) })).toEqual({});
  });

  it("roots a page path", () => {
    expect(parseFilters({ page_path: "pricing" }).page_path).toBe("/pricing");
  });

  it("only accepts a property key shaped like one, and a value only with a key", () => {
    expect(parseFilters({ prop_key: "plan_tier", prop_value: "pro" })).toEqual({ prop_key: "plan_tier", prop_value: "pro" });
    expect(parseFilters({ prop_key: "a'; DROP TABLE analytics_events; --", prop_value: "x" })).toEqual({});
    expect(parseFilters({ prop_key: "a->b" })).toEqual({});
    expect(parseFilters({ prop_value: "orphan" })).toEqual({});
  });
});

describe("filterSql", () => {
  it("is empty when nothing is filtered, so an unfiltered read's SQL is unchanged", () => {
    expect(filterSql({}, SITE, bounds)).toEqual({ __fragment: "" } as any);
    expect(sqlCalls).toHaveLength(0);
  });

  it("binds every value as a parameter — none of them appear in the SQL text", () => {
    const hostile = "x') OR 1=1 --";
    filterSql({ device: hostile, utm_source: hostile, prop_key: "plan", prop_value: hostile }, SITE, bounds);
    const call = sqlCalls[0]!;
    expect(call.text).not.toContain(hostile);
    expect(call.values.filter((v) => v === hostile).length).toBeGreaterThanOrEqual(3);
    expect(call.values).toContain("plan");
  });

  it("matches a browser by name or as a prefix, with LIKE wildcards taken literally", () => {
    filterSql({ browser: "Sam_sung%" }, SITE, bounds);
    expect(sqlCalls[0]!.values).toContain("sam\\_sung\\%%");
  });

  it("scopes the property filter's session lookup to the site and the window", () => {
    filterSql({ prop_key: "plan" }, SITE, bounds);
    expect(sqlCalls[0]!.values).toEqual(expect.arrayContaining([SITE, bounds.start, bounds.end]));
  });
});

describe("filtered reads", () => {
  it("reach the dashboard's raw queries", async () => {
    queueRows();
    await getDashboardStats(SITE, { country: "DE", live: "0" });
    // The filter fragments are built first; the two queries that splice them in follow.
    const withFilter = sqlCalls.filter((c) => c.values.includes("DE"));
    expect(withFilter.length).toBeGreaterThanOrEqual(2);
    expect(sqlCalls.some((c) => c.text.includes("analytics_events") && c.text.includes("session_id IN"))).toBe(true);
  });

  it("are read from raw events even when the rollups exist", async () => {
    setRollupsEnabled(true);
    queueRows();
    await getDimensionsBulkAnalytics(SITE, { device: "Mobile" });
    expect(sqlCalls.some((c) => c.text.includes("analytics_rollup"))).toBe(false);
    expect(sqlCalls.filter((c) => c.values.includes("Mobile")).length).toBeGreaterThanOrEqual(6);
  });

  it("leave an unfiltered read on the rollups", async () => {
    setRollupsEnabled(true);
    queueRows();
    await getDailyStatsAnalytics(SITE, { days: "7" });
    expect(sqlCalls.some((c) => c.text.includes("analytics_rollup_hourly"))).toBe(true);
  });
});
