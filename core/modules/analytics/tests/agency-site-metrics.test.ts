import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "../../../app/tests/helpers/fake-db";

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);

let svc: typeof import("../services/agency-site-metrics.service");
let rollups: typeof import("../rollups/reads");

beforeAll(async () => {
  svc = await import("../services/agency-site-metrics.service");
  rollups = await import("../rollups/reads");
});

beforeEach(() => {
  resetDb();
  rollups.setRollupsEnabled(false);
});

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const squash = (s: string) => s.replace(/\s+/g, " ");
const WINDOW = { from: "2026-10-11", to: "2026-10-17" };

describe("agency site metrics", () => {
  it("reads nothing for no sites", async () => {
    expect((await new svc.AnalyticsSiteMetrics().totalsBySite([], WINDOW)).size).toBe(0);
    expect(sqlCalls).toHaveLength(0);
  });

  it("merges traffic, event counts and revenue per site over the window", async () => {
    queueRows(
      [{ website_id: A, pageviews: "30", visitors: 10 }],
      [{ website_id: A, events: "120" }, { website_id: B, events: "4" }],
      [{ website_id: A, revenue: 99.999 }],
    );
    const out = await new svc.AnalyticsSiteMetrics().totalsBySite([A, B], WINDOW);
    expect(out.get(A)).toEqual({ visitors: 10, pageviews: 30, events: 120, revenue: 100 });
    expect(out.get(B)).toEqual({ events: 4 });
    expect(squash(sqlCalls[1]!.text)).toContain("FROM analytics_event_counts");
    expect(sqlCalls[1]!.values).toEqual([[A, B], WINDOW.from, WINDOW.to]);
  });

  it("reads the rollups when they exist", async () => {
    rollups.setRollupsEnabled(true);
    await new svc.AnalyticsSiteMetrics().totalsBySite([A], WINDOW);
    expect(squash(sqlCalls[0]!.text)).toContain("FROM analytics_rollup_daily");
    expect(squash(sqlCalls[2]!.text)).toContain("FROM analytics_revenue_orders");
  });
});

describe("tracking activity", () => {
  it("takes the last 24 hours from raw events and a quiet site's last day from the counts", async () => {
    queueRows(
      [{ website_id: A, last_day: "2026-10-17" }, { website_id: B, last_day: "2026-09-02" }],
      [{ website_id: A, last_at: "2026-10-17T10:00:00.000Z", n: 7 }],
      [],
    );
    const out = await new svc.AnalyticsTrackingActivity().activity([A, B]);
    expect(out.get(A)).toEqual({ lastEventAt: new Date("2026-10-17T10:00:00.000Z"), events24h: 7 });
    // Raw events past retention: the start of the last active day.
    expect(out.get(B)).toEqual({ lastEventAt: new Date("2026-09-02T00:00:00Z"), events24h: 0 });
    expect(sqlCalls[2]!.values).toEqual([[B], "2026-09-02"]);
  });

  it("leaves a site that never sent out of the map", async () => {
    queueRows([], []);
    expect((await new svc.AnalyticsTrackingActivity().activity([A])).size).toBe(0);
  });
});
