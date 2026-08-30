import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Website, WebsiteQuery, WebsiteRole } from "../../websites/interfaces";
import { fakeDbModule, fakeLogger } from "./helpers/fake-db";

/**
 * The analytics read path's one structural job: resolve the website exactly once per
 * request, then delegate.
 *
 * Repositories are injected rather than mocked. `mock.module` would work here, but its
 * registry is process-global — stubbing the repository modules from this file replaced
 * them for every test file that ran afterwards, which is what the service's injectable
 * repository table exists to avoid. The `db` mock below is only so importing the real
 * repository modules does not open a connection; nothing in this file reaches them.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

type RepoCall = { fn: string; args: unknown[] };
const repoCalls: RepoCall[] = [];

/** Distinct per function so a mis-wired delegation shows up as the wrong payload. */
function repoResult(fn: string) {
  return { __from: fn };
}

/**
 * Every repository export the service delegates to, as a recording stub.
 *
 * Built from the key list so the override object and the service's own table are
 * compared directly by the coverage test at the bottom.
 */
const REPO_EXPORTS = [
  "getDashboardStats",
  "getTrafficSummaryStats",
  "getDailyStatsAnalytics",
  "getHourlyStatsAnalytics",
  "getPagesAnalytics",
  "getReferrersAnalytics",
  "getSourcesAnalytics",
  "getBrowsersAnalytics",
  "getDevicesAnalytics",
  "getOsAnalytics",
  "getCountriesAnalytics",
  "getCitiesAnalytics",
  "getLanguagesAnalytics",
  "getResolutionsAnalytics",
  "getGeolocationAnalytics",
  "getPageUtmBreakdownAnalytics",
  "getDimensionsBulkAnalytics",
  "getRealtimeStats",
  "getRealtimeGeoAnalytics",
  "getLiveVisitorsStats",
  "getRecentActivityAnalytics",
  "getActivityTrendsStats",
  "getPathAnalysisAnalytics",
  "getVisitorInsightsAnalytics",
  "getCustomEventsAnalytics",
  "getGoalsStats",
  "getRevenueDashboard",
  "getExportAnalytics",
] as const;

function recordingRepositories(): Record<string, (...args: unknown[]) => Promise<unknown>> {
  return Object.fromEntries(
    REPO_EXPORTS.map((fn) => [
      fn,
      (...args: unknown[]) => {
        repoCalls.push({ fn, args });
        return Promise.resolve(repoResult(fn));
      },
    ]),
  );
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const WEBSITE = "site_known";
const MISSING = "site_missing";
const QUERY = { days: "30", timezone: "Asia/Dhaka", limit: "25" };

class FakeWebsiteQuery implements WebsiteQuery {
  known = new Set<string>([WEBSITE]);
  lookups: string[] = [];

  async getById(ref: string): Promise<Website | null> {
    this.lookups.push(ref);
    return this.known.has(ref) ? ({ id: ref } as Website) : null;
  }

  async getRole(): Promise<WebsiteRole | null> {
    throw new Error("the service authorizes nothing — that is the router's job");
  }

  async listOwnedBy(): Promise<Website[]> {
    throw new Error("unused");
  }
}

/**
 * Method → the repository export it must reach, and the arguments the repository
 * must receive when the service is called as `method(WEBSITE, QUERY)`.
 *
 * Written out rather than derived: a table generated from the implementation would
 * agree with it by construction and assert nothing.
 */
const DELEGATIONS: Array<{
  method: string;
  repo: string;
  callWith: unknown[];
  expectArgs: unknown[];
}> = [
  { method: "getDashboard", repo: "getDashboardStats", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getTrafficSummary", repo: "getTrafficSummaryStats", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getDailyStats", repo: "getDailyStatsAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getHourlyStats", repo: "getHourlyStatsAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getPages", repo: "getPagesAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getReferrers", repo: "getReferrersAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getSources", repo: "getSourcesAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getBrowsers", repo: "getBrowsersAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getDevices", repo: "getDevicesAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getOperatingSystems", repo: "getOsAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getCountries", repo: "getCountriesAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getCities", repo: "getCitiesAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getLanguages", repo: "getLanguagesAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getResolutions", repo: "getResolutionsAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getGeolocation", repo: "getGeolocationAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getPageUtmBreakdown", repo: "getPageUtmBreakdownAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getDimensionsBulk", repo: "getDimensionsBulkAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getActivityTrends", repo: "getActivityTrendsStats", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getPathAnalysis", repo: "getPathAnalysisAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getVisitorInsights", repo: "getVisitorInsightsAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getCustomEvents", repo: "getCustomEventsAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getGoals", repo: "getGoalsStats", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "getRevenueDashboard", repo: "getRevenueDashboard", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },
  { method: "exportEvents", repo: "getExportAnalytics", callWith: [WEBSITE, QUERY], expectArgs: [WEBSITE, QUERY] },

  // Realtime — fixed or minute-based windows, so different argument shapes.
  { method: "getRealtime", repo: "getRealtimeStats", callWith: [WEBSITE], expectArgs: [WEBSITE] },
  { method: "getLiveVisitors", repo: "getLiveVisitorsStats", callWith: [WEBSITE], expectArgs: [WEBSITE] },
  {
    method: "getRealtimeGeo",
    repo: "getRealtimeGeoAnalytics",
    callWith: [WEBSITE, { withinMinutes: 45 }],
    expectArgs: [WEBSITE, { withinMinutes: 45 }],
  },
  {
    method: "getRecentActivity",
    repo: "getRecentActivityAnalytics",
    callWith: [WEBSITE, 25, { withinMinutes: 30 }],
    expectArgs: [WEBSITE, 25, { withinMinutes: 30 }],
  },
];

// ─── Load the service after the mocks ────────────────────────────────────────

let AnalyticsQueryService: typeof import("../services/analytics-query.service").AnalyticsQueryService;
let UnknownWebsiteError: typeof import("../services/analytics-query.service").UnknownWebsiteError;
let defaultAnalyticsRepositories: typeof import("../services/analytics-query.service").defaultAnalyticsRepositories;

beforeAll(async () => {
  ({ AnalyticsQueryService, UnknownWebsiteError, defaultAnalyticsRepositories } = await import(
    "../services/analytics-query.service"
  ));
});

describe("AnalyticsQueryService", () => {
  let websites: FakeWebsiteQuery;
  let service: Record<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(() => {
    repoCalls.length = 0;
    websites = new FakeWebsiteQuery();
    service = new AnalyticsQueryService(
      websites,
      recordingRepositories() as never,
    ) as unknown as typeof service;
  });

  // ─── Existence check ──────────────────────────────────────────────────────

  describe("website resolution", () => {
    for (const { method, callWith } of DELEGATIONS) {
      it(`${method} rejects an unknown website with UnknownWebsiteError`, async () => {
        const args = [MISSING, ...callWith.slice(1)];
        await expect(service[method]!(...args)).rejects.toBeInstanceOf(UnknownWebsiteError);
      });

      it(`${method} does not query the repository for an unknown website`, async () => {
        // The failure mode this prevents: a typo'd site id rendering as "no traffic"
        // instead of an error, which is indistinguishable from a real empty dashboard.
        const args = [MISSING, ...callWith.slice(1)];
        await service[method]!(...args).catch(() => {});
        expect(repoCalls).toHaveLength(0);
      });

      it(`${method} resolves the website exactly once`, async () => {
        await service[method]!(...callWith);
        expect(websites.lookups).toEqual([WEBSITE]);
      });
    }

    it("carries a 404 status so the HTTP layer does not report a 500", async () => {
      const err = await service.getDashboard!(MISSING, {}).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnknownWebsiteError);
      expect((err as { status: number }).status).toBe(404);
      expect((err as Error).name).toBe("UnknownWebsiteError");
      expect((err as Error).message).toContain(MISSING);
    });

    it("re-resolves on every call rather than caching across requests", async () => {
      // A site deleted between two requests must stop answering on the second.
      await service.getDashboard!(WEBSITE, {});
      websites.known.delete(WEBSITE);
      await expect(service.getDashboard!(WEBSITE, {})).rejects.toBeInstanceOf(UnknownWebsiteError);
      expect(websites.lookups).toEqual([WEBSITE, WEBSITE]);
    });

    it("treats resolution failure as a hard error, not an empty result", async () => {
      class Exploding extends FakeWebsiteQuery {
        override async getById(): Promise<Website | null> {
          throw new Error("websites module is down");
        }
      }
      const s = new AnalyticsQueryService(
        new Exploding(),
        recordingRepositories() as never,
      ) as unknown as typeof service;
      await expect(s.getDashboard!(WEBSITE, {})).rejects.toThrow("websites module is down");
      expect(repoCalls).toHaveLength(0);
    });
  });

  // ─── Delegation ───────────────────────────────────────────────────────────

  describe("delegation", () => {
    for (const { method, repo, callWith, expectArgs } of DELEGATIONS) {
      it(`${method} calls ${repo} with the arguments it was given`, async () => {
        await service[method]!(...callWith);
        expect(repoCalls).toEqual([{ fn: repo, args: expectArgs }]);
      });

      it(`${method} returns the repository's result untransformed`, async () => {
        // These are SQL projections consumed directly by the dashboard; the service
        // adding or reshaping a field here would silently change the wire contract.
        await expect(service[method]!(...callWith)).resolves.toEqual(repoResult(repo));
      });
    }

    it("does not share a repository between two different reads", async () => {
      // getActivityTrends delegates to its own export even though that export is a
      // thin wrapper over daily stats — collapsing them would couple two endpoints.
      await service.getDailyStats!(WEBSITE, QUERY);
      await service.getActivityTrends!(WEBSITE, QUERY);
      expect(repoCalls.map((c) => c.fn)).toEqual([
        "getDailyStatsAnalytics",
        "getActivityTrendsStats",
      ]);
    });

    it("passes the query bag by reference without mutating it", async () => {
      const query = { days: "7" };
      await service.getDashboard!(WEBSITE, query);
      expect(query).toEqual({ days: "7" });
    });

    it("forwards an omitted realtime-geo option as undefined", async () => {
      await service.getRealtimeGeo!(WEBSITE);
      expect(repoCalls).toEqual([{ fn: "getRealtimeGeoAnalytics", args: [WEBSITE, undefined] }]);
    });
  });

  // ─── The invariant, enforced reflectively ─────────────────────────────────

  describe("no read may skip the existence check", () => {
    /** Public read methods on the prototype, excluding the constructor. */
    function readMethods(): string[] {
      return Object.getOwnPropertyNames(AnalyticsQueryService.prototype).filter(
        (n) => n !== "constructor" && n !== "assertExists",
      );
    }

    it("every public method on the service rejects an unknown website", async () => {
      // The point of doing this reflectively instead of from the table: a method added
      // to the service later is covered the day it is written, even if whoever added it
      // never touched this file. A missing `await this.assertExists(...)` fails here.
      const offenders: string[] = [];

      for (const name of readMethods()) {
        repoCalls.length = 0;
        // Arguments are deliberately loose — every method must throw before it reads them.
        const outcome = await service[name]!(MISSING, {}, {}).then(
          () => "resolved",
          (e: unknown) => (e instanceof UnknownWebsiteError ? "rejected" : `threw ${String(e)}`),
        );
        if (outcome !== "rejected" || repoCalls.length > 0) offenders.push(`${name}: ${outcome}`);
      }

      expect(offenders).toEqual([]);
    });

    it("the delegation table covers every public method", async () => {
      const tabled = new Set(DELEGATIONS.map((d) => d.method));
      const untabled = readMethods().filter((m) => !tabled.has(m));
      expect(untabled).toEqual([]);
    });

    it("the delegation table names only methods that exist", async () => {
      const actual = new Set(readMethods());
      const stale = DELEGATIONS.map((d) => d.method).filter((m) => !actual.has(m));
      expect(stale).toEqual([]);
    });

    it("stubs exactly the repository table the service declares", async () => {
      // Compared against the service's own default table rather than against a copy of
      // the import list: a repository added to the service but not stubbed here would
      // otherwise run for real against the fake driver and pass by accident.
      const declared = new Set(Object.keys(defaultAnalyticsRepositories));
      const stubbed = new Set(REPO_EXPORTS as readonly string[]);

      expect([...declared].filter((e) => !stubbed.has(e))).toEqual([]);
      expect([...stubbed].filter((e) => !declared.has(e))).toEqual([]);
    });

    it("routes every delegation through a declared repository key", async () => {
      const declared = new Set(Object.keys(defaultAnalyticsRepositories));
      expect(DELEGATIONS.map((d) => d.repo).filter((r) => !declared.has(r))).toEqual([]);
    });

    it("leaves the real repository table intact when nothing is overridden", async () => {
      // The override is a partial merge, so a service constructed without one must
      // still hold the production functions.
      const plain = new AnalyticsQueryService(websites) as unknown as {
        repos: Record<string, unknown>;
      };
      expect(plain.repos).toEqual(defaultAnalyticsRepositories);
    });
  });
});
