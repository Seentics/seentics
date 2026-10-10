import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "./helpers/fake-db";

/**
 * The live-visitor badge and the windows it shares with the dashboard.
 *
 * What is worth pinning here is not the SQL but the shaping around it — the window
 * selection that decides who counts as "live", and the normalisation of absent fields.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);

let REALTIME_WINDOW_MS: number;
let LIVE_VISITOR_WINDOW_MS: number;
let getLiveVisitorsStats: typeof import("../repositories/live-visitors.repository").getLiveVisitorsStats;

beforeAll(async () => {
  const rt = await import("../repositories/realtime.repository");
  REALTIME_WINDOW_MS = rt.REALTIME_WINDOW_MS;
  LIVE_VISITOR_WINDOW_MS = rt.LIVE_VISITOR_WINDOW_MS;
  ({ getLiveVisitorsStats } = await import("../repositories/live-visitors.repository"));
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
  it("defines 30 minutes for the active window and five minutes for the live badge", async () => {
    // Both are read by other repositories (dashboard, live-visitors), so a change here
    // silently moves two surfaces at once.
    expect(REALTIME_WINDOW_MS).toBe(1_800_000);
    expect(LIVE_VISITOR_WINDOW_MS).toBe(300_000);
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

  it("scans a 30-minute range while filtering the live count to five minutes", async () => {
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
