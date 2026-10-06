import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Logger } from "../../../platform/observability/logger";
import type { AnalyticsFunnelEvents } from "../../analytics/interfaces";
import type { Website, WebsiteQuery, WebsiteRole } from "../../websites/interfaces";
import type {
  Funnel,
  FunnelMutations,
  FunnelPerformance,
  FunnelQuery,
  FunnelTrackerConfig,
} from "../interfaces";

// ─── Mocks — must be declared before the dynamic import below ────────────────
//
// The repositories are the module's only database contact, so faking them at the
// module boundary is what keeps every test in this file DB-free. Each fake records
// the *identifier it was called with*: that is the assertion these tests exist for,
// since `websiteId` and the website UUID are both `string` and the compiler cannot tell
// a mixed-up pair from a correct one.

type RepoCall = { fn: string; websiteId: string };

const repoCalls: RepoCall[] = [];
const batchCalls: string[][] = [];
const reportCalls: { websiteId: string; steps: unknown[]; startIso: string; endIso: string; windowHours: number | null }[] = [];

let funnelRows: Funnel[] = [];

function record(fn: string) {
  return (websiteId: string, ...rest: unknown[]) => {
    repoCalls.push({ fn, websiteId });
    void rest;
  };
}

const mockListFunnels = mock(async (websiteId: string) => {
  record("listFunnels")(websiteId);
  return funnelRows;
});
const mockListActiveFunnels = mock(async (websiteId: string) => {
  record("listActiveFunnels")(websiteId);
  return funnelRows.filter((f) => f.is_active);
});
const mockFindFunnel = mock(async (websiteId: string, funnelId: string) => {
  record("findFunnel")(websiteId);
  return funnelRows.find((f) => f.id === funnelId) ?? null;
});
const mockInsertFunnel = mock(async (websiteId: string, userId: string, input: unknown) => {
  record("insertFunnel")(websiteId);
  const body = input as { name?: string; steps?: unknown[] };
  const created = makeFunnel({
    id: "fn_new",
    website_id: websiteId,
    user_id: userId,
    name: body.name ?? "",
    steps: (body.steps ?? []).map((_s, i) => ({
      id: `s${i}`,
      name: `Step ${i}`,
      order: i,
      step_type: "page_view",
      match_type: "exact" as const,
    })),
  });
  funnelRows.push(created);
  return created;
});
const mockUpdateFunnel = mock(async (websiteId: string, funnelId: string, _patch: unknown) => {
  record("updateFunnel")(websiteId);
  return funnelRows.find((f) => f.id === funnelId) ?? null;
});
const mockDeleteFunnel = mock(async (websiteId: string, _funnelId: string) => {
  record("deleteFunnel")(websiteId);
});
const mockDeleteFunnels = mock(async (websiteId: string, _funnelIds: string[]) => {
  record("deleteFunnels")(websiteId);
});

mock.module("../repositories/funnel.repository", () => ({
  listFunnels: mockListFunnels,
  listActiveFunnels: mockListActiveFunnels,
  findFunnel: mockFindFunnel,
  insertFunnel: mockInsertFunnel,
  updateFunnel: mockUpdateFunnel,
  deleteFunnel: mockDeleteFunnel,
  deleteFunnels: mockDeleteFunnels,
}));

/**
 * Step counts arrive through `AnalyticsFunnelEvents` now — the events live in
 * `analytics_events`, so the aggregation belongs to that module. A plain object
 * replaces what used to be a `mock.module` of a funnels-owned repository.
 */
const analyticsEvents: AnalyticsFunnelEvents = {
  async countFunnelsProgress(websiteId, funnels, startIso, endIso) {
    batchCalls.push(funnels.map(f => f.id));
    return Object.fromEntries(await Promise.all(funnels.map(async f => [f.id, await this.countFunnelProgress(websiteId, f.steps, startIso, endIso, f.windowHours)])));
  },
  async countFunnelStepVisitors() {
    throw new Error("the report no longer reads the browser's funnel events");
  },
  async isValidPattern(pattern) {
    return !pattern.startsWith("(unclosed");
  },
  async countFunnelProgress(websiteId, steps, startIso, endIso, windowHours) {
    reportCalls.push({ websiteId, steps, startIso, endIso, windowHours: windowHours ?? null });
    const reached = [10, 4, 2, 1];
    return [...steps.map((_, i) => ({ step_order: i, cnt: reached[i] ?? 0 })), { step_order: -1, cnt: reached[steps.length - 1] ?? 0 }];
  },
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const WEBSITE_UUID = "11111111-1111-4111-8111-111111111111";

const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

function makeFunnel(overrides: Partial<Funnel> = {}): Funnel {
  const steps = overrides.steps ?? [
    { id: "s0", name: "View", order: 0, step_type: "page_view", page_path: "/view", match_type: "exact" as const },
    { id: "s1", name: "Pay", order: 1, step_type: "page_view", page_path: "/pay", match_type: "exact" as const },
  ];
  return {
    id: "fn_1",
    website_id: WEBSITE_UUID,
    user_id: "user_1",
    name: "Checkout",
    description: "",
    is_active: true,
    conversion_window_hours: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    stats: { totalEntries: 0, completions: 0, conversionRate: 0, stepBreakdown: [] },
    ...overrides,
    steps,
  };
}

function makeWebsite(): Website {
  return {
    id: WEBSITE_UUID,
    ownerId: "user_1",
    name: "One",
    url: "one.example",
    trackingId: "ST-0001",
    isActive: true,
    isVerified: true,
    automationEnabled: true,
    funnelEnabled: true,
    errorsEnabled: true,
    heatmapEnabled: true,
    heatmapIncludePatterns: null,
    heatmapExcludePatterns: null,
    heatmapLayoutEnabled: true,
    replayEnabled: true,
    replaySamplingRate: 1,
    replayIncludePatterns: null,
    replayExcludePatterns: null,
    maskAllText: false,
    maskTextPatterns: null,
    verificationToken: "tok",
    publicShareId: null,
    settings: {
      allowedOrigins: [],
      trackingEnabled: true,
      dataRetentionDays: 365,
      useIpAnonymization: false,
      respectDoNotTrack: false,
      allowRawDataExport: false,
    },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

/**
 * In-memory `WebsiteQuery`. Exists to prove the service resolves through the port
 * and never touches the `websites` table itself — the whole point of the extraction.
 * `lookups` records every reference asked for, so "resolved once per request" is an
 * assertion rather than a claim.
 */
class FakeWebsiteQuery implements WebsiteQuery {
  lookups: string[] = [];
  known = new Map<string, Website>();

  seed(website: Website): Website {
    this.known.set(website.id, website);
    this.known.set(website.id, website);
    return website;
  }

  async getById(websiteRef: string): Promise<Website | null> {
    this.lookups.push(websiteRef);
    return this.known.get(websiteRef) ?? null;
  }

  async listOwnedBy(): Promise<Website[]> {
    return [...new Set(this.known.values())];
  }

  async getRole(): Promise<WebsiteRole | null> {
    // Access control is the route's job; the service is never asked.
    throw new Error("FunnelService must not perform access checks");
  }
}

// ─── Load the service after the mocks ────────────────────────────────────────

let FunnelDefinitionService: typeof import("../services/funnel-definition.service").FunnelDefinitionService;
let FunnelPerformanceService: typeof import("../services/funnel-performance.service").FunnelPerformanceService;
let TrackerFunnelConfigService: typeof import("../services/tracker-funnel-config.service").TrackerFunnelConfigService;

beforeAll(async () => {
  ({ FunnelDefinitionService } = await import("../services/funnel-definition.service"));
  ({ FunnelPerformanceService } = await import("../services/funnel-performance.service"));
  ({ TrackerFunnelConfigService } = await import("../services/tracker-funnel-config.service"));
});

describe("funnel domain services", () => {
  let websites: FakeWebsiteQuery;
  let service: FunnelQuery & FunnelMutations & FunnelPerformance & FunnelTrackerConfig;

  beforeEach(() => {
    batchCalls.length = 0;
    repoCalls.length = 0;
    reportCalls.length = 0;
    funnelRows = [makeFunnel()];
    websites = new FakeWebsiteQuery();
    websites.seed(makeWebsite());
    const definitions = new FunnelDefinitionService();
    const performance = new FunnelPerformanceService(analyticsEvents);
    const tracker = new TrackerFunnelConfigService();
    service = {
      list: definitions.list.bind(definitions),
      get: definitions.get.bind(definitions),
      create: definitions.create.bind(definitions),
      update: definitions.update.bind(definitions),
      remove: definitions.remove.bind(definitions),
      bulkRemove: definitions.bulkRemove.bind(definitions),
      report: performance.report.bind(performance),
      reports: performance.reports.bind(performance),
      activeForTracker: tracker.activeForTracker.bind(tracker),
    };
  });

  /**
   * The failure this whole refactor is designed to prevent: definitions live in
   * `funnels` keyed by the website UUID, the events they are measured against live
   * in `analytics_events` keyed by the short `websiteId`. Both are `string`, so
   * swapping them compiles and silently returns nothing.
   */
  /**
   * This block used to prove the two identifiers never got crossed: funnel definitions
   * were keyed by the website UUID while the events they aggregate were keyed by a
   * shorter public id, so a report needed both and using the wrong one returned zero
   * rows with no error. One column keys both now, and these assert that the same id
   * reaches the definition repository and the events aggregation.
   */
  describe("identifier routing", () => {
    it("queries funnel definitions by the website id", async () => {
      await service.list(WEBSITE_UUID);
      expect(repoCalls).toEqual([{ fn: "listFunnels", websiteId: WEBSITE_UUID }]);
    });

    it("reads the definition and the events aggregation by the same id", async () => {
      await service.report(WEBSITE_UUID, "fn_1");

      expect(repoCalls).toEqual([{ fn: "findFunnel", websiteId: WEBSITE_UUID }]);
      expect(reportCalls).toHaveLength(1);
      expect(reportCalls[0]?.websiteId).toBe(WEBSITE_UUID);
    });

    it("routes every mutation by that id", async () => {
      await service.create(WEBSITE_UUID, "user_1", { name: "New" });
      await service.update(WEBSITE_UUID, "fn_1", { name: "Renamed" });
      await service.remove(WEBSITE_UUID, "fn_1");
      await service.bulkRemove(WEBSITE_UUID, ["fn_1", "fn_2"]);

      expect(repoCalls.map((c) => c.websiteId)).toEqual([
        WEBSITE_UUID,
        WEBSITE_UUID,
        WEBSITE_UUID,
        WEBSITE_UUID,
      ]);
    });

    // The tracker path is on the hottest public endpoint, so it must not spend a
    // website lookup it does not need.
    it("does not look the website up on the tracker path", async () => {
      await service.activeForTracker(WEBSITE_UUID);

      expect(websites.lookups).toEqual([]);
      expect(repoCalls).toEqual([{ fn: "listActiveFunnels", websiteId: WEBSITE_UUID }]);
    });

  });

  describe("report", () => {
    it("loads all definitions once and requests one aggregation batch", async () => {
      funnelRows = [makeFunnel({ id: "first" }), makeFunnel({ id: "second" })];
      const reports = await service.reports(WEBSITE_UUID, 7);
      expect(Object.keys(reports)).toEqual(["first", "second"]);
      expect(batchCalls).toEqual([["first", "second"]]);
      expect(repoCalls.filter(c => c.fn === "listFunnels")).toHaveLength(1);
      expect(repoCalls.filter(c => c.fn === "findFunnel")).toHaveLength(0);
      expect(reports.first.completions).toBe(4);
    });
    it("computes the report from the definition's steps", async () => {
      const report = await service.report(WEBSITE_UUID, "fn_1");

      expect(report).toMatchObject({
        totalEntries: 10,
        completions: 4,
        conversionRate: 40,
      });
      expect(report?.stepBreakdown.map((s) => s.stepName)).toEqual(["View", "Pay"]);
    });

    it("counts from the page views and events, handing over each step as a definition", async () => {
      await service.report(WEBSITE_UUID, "fn_1");
      expect(reportCalls[0]?.steps).toEqual([
        { kind: "page", path: "/view", match: "exact" },
        { kind: "page", path: "/pay", match: "exact" },
      ]);
    });

    it("reads an event step by its event name", async () => {
      mockFindFunnel.mockResolvedValueOnce(makeFunnel({
        steps: [
          { id: "s0", name: "Land", order: 0, step_type: "page_view", page_path: "/", match_type: "exact" },
          { id: "s1", name: "Buy", order: 1, step_type: "event", event_type: "purchase", match_type: "exact" },
        ],
      }));
      await service.report(WEBSITE_UUID, "fn_1");
      expect(reportCalls[0]?.steps).toEqual([
        { kind: "page", path: "/", match: "exact" },
        { kind: "event", event: "purchase" },
      ]);
    });

    it("hands the funnel's time between steps to the count", async () => {
      mockFindFunnel.mockResolvedValueOnce(makeFunnel({ conversion_window_hours: 24 }));
      await service.report(WEBSITE_UUID, "fn_1");
      expect(reportCalls[0]?.windowHours).toBe(24);
      await service.report(WEBSITE_UUID, "fn_1");
      expect(reportCalls[1]?.windowHours).toBeNull();
    });

    it("does not fail on a pattern the database cannot run, and says which step it is", async () => {
      mockFindFunnel.mockResolvedValueOnce(makeFunnel({
        steps: [
          { id: "s0", name: "View", order: 0, step_type: "page_view", page_path: "/view", match_type: "exact" },
          { id: "s1", name: "Checkout", order: 1, step_type: "page_view", page_path: "(unclosed", match_type: "regex" },
        ],
      }));
      const report = await service.report(WEBSITE_UUID, "fn_1");
      expect(report?.completions).toBe(0);
      expect(report?.warnings?.[0]).toContain("Checkout");
      expect(report?.warnings?.[0]).toContain("not a valid regular expression");
    });

    it("never completes a funnel that has a step with nothing to match", async () => {
      mockFindFunnel.mockResolvedValueOnce(makeFunnel({
        steps: [
          { id: "s0", name: "View", order: 0, step_type: "page_view", page_path: "/view", match_type: "exact" },
          { id: "s1", name: "Broken", order: 1, step_type: "page_view", match_type: "exact" },
          { id: "s2", name: "Pay", order: 2, step_type: "page_view", page_path: "/pay", match_type: "exact" },
        ],
      }));
      const report = await service.report(WEBSITE_UUID, "fn_1");
      expect(reportCalls[0]?.steps).toHaveLength(1);   // only the part that can be reached is counted
      expect(report?.totalEntries).toBe(10);
      expect(report?.completions).toBe(0);
      expect(report?.stepBreakdown.map((s) => s.count)).toEqual([10, 0, 0]);
    });

    it("returns null for a funnel that does not exist", async () => {
      expect(await service.report(WEBSITE_UUID, "missing")).toBeNull();
      expect(reportCalls).toEqual([]);
    });

    it("clamps the requested window before querying", async () => {
      await service.report(WEBSITE_UUID, "fn_1", 100_000);

      const { startIso, endIso } = reportCalls[0]!;
      const spanDays = (Date.parse(endIso) - Date.parse(startIso)) / 86_400_000;
      expect(spanDays).toBe(31);
    });
  });

  describe("mutations", () => {
    it("returns null when the update matched no row", async () => {
      expect(await service.update(WEBSITE_UUID, "missing", { name: "x" })).toBeNull();
    });

  });

  describe("bulkRemove", () => {
    // An empty `inArray` filter would delete the website's entire funnel list, so
    // this guard runs before anything else — including the website lookup.
    it("is a no-op for an empty id list", async () => {
      await service.bulkRemove(WEBSITE_UUID, []);

      expect(repoCalls).toEqual([]);
      expect(websites.lookups).toEqual([]);
    });
  });

});
