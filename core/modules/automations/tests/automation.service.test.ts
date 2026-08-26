import { describe, it, expect, beforeEach } from "bun:test";
import type {
  AutomationDailyRuns,
  AutomationExecutionRow,
  AutomationListItem,
  AutomationRepository,
  AutomationRow,
  AutomationStats,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "../interfaces";
import {
  AutomationService,
  UnknownWebsiteError,
} from "../services/automation.service";
import type { Website, WebsiteQuery, WebsiteRole } from "../../websites/interfaces";

const WEBSITE_UUID = "11111111-1111-4111-8111-111111111111";
const SITE_ID = "site_one";

function makeWebsite(): Website {
  return {
    id: WEBSITE_UUID,
    siteId: SITE_ID,
    ownerId: "owner_1",
    name: "One",
    url: "one.example",
    trackingId: "ST-0001",
    isActive: true,
    isVerified: false,
    automationEnabled: true,
    funnelEnabled: true,
    heatmapEnabled: true,
    heatmapIncludePatterns: null,
    heatmapExcludePatterns: null,
    heatmapLayoutEnabled: true,
    replayEnabled: true,
    replaySamplingRate: 1,
    replayIncludePatterns: null,
    replayExcludePatterns: null,
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

/** Records every lookup so tests can assert resolution happens exactly once. */
class FakeWebsiteQuery implements WebsiteQuery {
  lookups: string[] = [];
  constructor(private readonly websites: Website[] = [makeWebsite()]) {}

  async getById(websiteRef: string): Promise<Website | null> {
    this.lookups.push(websiteRef);
    return this.websites.find((w) => w.id === websiteRef || w.siteId === websiteRef) ?? null;
  }
  async listOwnedBy(): Promise<Website[]> {
    return this.websites;
  }
  async getRole(): Promise<WebsiteRole | null> {
    return "owner";
  }
}

function makeRow(overrides: Partial<AutomationRow> = {}): AutomationRow {
  return {
    id: "auto_1",
    websiteId: WEBSITE_UUID,
    name: "Welcome",
    isActive: true,
    ...overrides,
  } as AutomationRow;
}

/**
 * In-memory repository that records the website id it was handed for every call.
 *
 * That recording is the point of most tests here: `automations.website_id` is a
 * uuid column, so a `siteId` reaching it matches zero rows *without erroring* and
 * looks exactly like "this website has no automations".
 */
class FakeAutomationRepository implements AutomationRepository {
  receivedWebsiteIds: string[] = [];
  rows: AutomationRow[] = [];
  deleted: [string, string][] = [];
  executions: AutomationExecutionRow[] = [];

  private record(websiteId: string) {
    this.receivedWebsiteIds.push(websiteId);
  }

  async listWithStats(websiteId: string): Promise<AutomationListItem[]> {
    this.record(websiteId);
    return this.rows as unknown as AutomationListItem[];
  }
  async listActive(websiteId: string): Promise<AutomationRow[]> {
    this.record(websiteId);
    return this.rows.filter((r) => r.isActive);
  }
  async listActiveByPriority(websiteId: string): Promise<AutomationRow[]> {
    this.record(websiteId);
    return this.rows.filter((r) => r.isActive);
  }
  async findById(websiteId: string, automationId: string): Promise<AutomationRow | null> {
    this.record(websiteId);
    return this.rows.find((r) => r.id === automationId) ?? null;
  }
  async create(
    websiteId: string,
    _userId: string,
    input: CreateAutomationInput,
  ): Promise<AutomationRow> {
    this.record(websiteId);
    const row = makeRow({ id: `auto_${this.rows.length + 1}`, name: input.name });
    this.rows.push(row);
    return row;
  }
  async update(
    websiteId: string,
    automationId: string,
    _patch: UpdateAutomationInput,
  ): Promise<AutomationRow | null> {
    this.record(websiteId);
    return this.rows.find((r) => r.id === automationId) ?? null;
  }
  async toggleActive(websiteId: string, automationId: string): Promise<AutomationRow | null> {
    this.record(websiteId);
    const row = this.rows.find((r) => r.id === automationId);
    if (!row) return null;
    row.isActive = !row.isActive;
    return row;
  }
  async delete(websiteId: string, automationId: string): Promise<void> {
    this.record(websiteId);
    this.deleted.push([websiteId, automationId]);
    this.rows = this.rows.filter((r) => r.id !== automationId);
  }
  async listExecutions(automationId: string, limit: number): Promise<AutomationExecutionRow[]> {
    return this.executions.filter((e) => e.automationId === automationId).slice(0, limit);
  }
  async getStats(_automationId: string): Promise<AutomationStats> {
    return { totalRuns: 3 } as unknown as AutomationStats;
  }
  async getDailyRuns(_automationId: string): Promise<AutomationDailyRuns[]> {
    return [] as unknown as AutomationDailyRuns[];
  }
}

describe("AutomationService", () => {
  let websites: FakeWebsiteQuery;
  let repo: FakeAutomationRepository;
  let service: AutomationService;

  beforeEach(() => {
    websites = new FakeWebsiteQuery();
    repo = new FakeAutomationRepository();
    service = new AutomationService(repo, websites);
  });

  describe("resolve-once", () => {
    it("resolves the website exactly once per read", async () => {
      await service.list(WEBSITE_UUID);
      expect(websites.lookups).toEqual([WEBSITE_UUID]);
    });

    it("resolves exactly once per write", async () => {
      await service.create(WEBSITE_UUID, "owner_1", { name: "New" } as CreateAutomationInput);
      expect(websites.lookups).toEqual([WEBSITE_UUID]);
    });

    // The insight reads do two repository calls (ownership check, then the log),
    // but still only one website resolution.
    it("resolves once even when the call makes two repository reads", async () => {
      repo.rows.push(makeRow());
      await service.stats(WEBSITE_UUID, "auto_1");
      expect(websites.lookups).toEqual([WEBSITE_UUID]);
    });
  });

  // The load-bearing assertion for this module: `automations.website_id` is a uuid
  // column, and a siteId predicate against it silently matches nothing.
  describe("identifier routing", () => {
    it("hands the repository the UUID when given a UUID", async () => {
      await service.list(WEBSITE_UUID);
      expect(repo.receivedWebsiteIds).toEqual([WEBSITE_UUID]);
    });

    it("hands the repository the UUID when given a siteId", async () => {
      await service.list(SITE_ID);
      expect(repo.receivedWebsiteIds).toEqual([WEBSITE_UUID]);
    });

    it("never leaks a siteId into the repository on a write", async () => {
      await service.create(SITE_ID, "owner_1", { name: "New" } as CreateAutomationInput);
      expect(repo.receivedWebsiteIds).toEqual([WEBSITE_UUID]);
      expect(repo.receivedWebsiteIds).not.toContain(SITE_ID);
    });

    it("scopes a delete to the resolved UUID", async () => {
      repo.rows.push(makeRow());
      await service.remove(SITE_ID, "auto_1");
      expect(repo.deleted).toEqual([[WEBSITE_UUID, "auto_1"]]);
    });
  });

  // Reads answer empty, writes throw — because a write has no id to write against,
  // while a read genuinely has nothing to return.
  describe("unknown website", () => {
    beforeEach(() => {
      websites = new FakeWebsiteQuery([]);
      service = new AutomationService(repo, websites);
    });

    it("returns an empty list", async () => {
      expect(await service.list("missing")).toEqual([]);
      expect(repo.receivedWebsiteIds).toEqual([]);
    });

    it("returns null from get", async () => {
      expect(await service.get("missing", "auto_1")).toBeNull();
    });

    it("returns null from update", async () => {
      expect(await service.update("missing", "auto_1", {} as UpdateAutomationInput)).toBeNull();
    });

    it("returns null from toggle", async () => {
      expect(await service.toggle("missing", "auto_1")).toBeNull();
    });

    it("returns an empty list from activeFor", async () => {
      expect(await service.activeFor("missing")).toEqual([]);
    });

    it("is a silent no-op for remove", async () => {
      await expect(service.remove("missing", "auto_1")).resolves.toBeUndefined();
      expect(repo.deleted).toEqual([]);
    });

    it("throws forbidden — not not-found — on create", async () => {
      const err = await service
        .create("missing", "owner_1", { name: "x" } as CreateAutomationInput)
        .catch((e) => e);

      expect(err).toBeInstanceOf(UnknownWebsiteError);
      // Says "forbidden" so the API cannot be used to enumerate which site ids
      // exist; admitting "not found" here would undo the routes' 403.
      expect(err.status).toBe(403);
      expect(err.message).toBe("forbidden");
    });

    it("returns null from the insight reads", async () => {
      expect(await service.executions("missing", "auto_1")).toBeNull();
      expect(await service.stats("missing", "auto_1")).toBeNull();
      expect(await service.dailyStats("missing", "auto_1")).toBeNull();
    });
  });

  /**
   * `automation_events` has no website column — it is keyed by `automation_id`
   * alone. Without the ownership check first, anyone able to read one website's
   * automations could read any automation's execution log by guessing a UUID.
   */
  describe("cross-website isolation on insight reads", () => {
    it("refuses executions for an automation that is not this website's", async () => {
      repo.executions.push({ automationId: "someone_elses" } as AutomationExecutionRow);

      expect(await service.executions(WEBSITE_UUID, "someone_elses")).toBeNull();
    });

    it("refuses stats for an automation that is not this website's", async () => {
      expect(await service.stats(WEBSITE_UUID, "someone_elses")).toBeNull();
    });

    it("refuses daily stats for an automation that is not this website's", async () => {
      expect(await service.dailyStats(WEBSITE_UUID, "someone_elses")).toBeNull();
    });

    it("allows them once the automation belongs to the website", async () => {
      repo.rows.push(makeRow());
      expect(await service.stats(WEBSITE_UUID, "auto_1")).not.toBeNull();
    });
  });

  describe("bulkDelete", () => {
    it("deletes every id under the resolved website", async () => {
      repo.rows.push(makeRow({ id: "a" }), makeRow({ id: "b" }), makeRow({ id: "c" }));

      await service.bulkDelete(WEBSITE_UUID, ["a", "b", "c"]);

      expect(repo.deleted).toEqual([
        [WEBSITE_UUID, "a"],
        [WEBSITE_UUID, "b"],
        [WEBSITE_UUID, "c"],
      ]);
    });

    it("resolves the website once for the whole batch", async () => {
      await service.bulkDelete(WEBSITE_UUID, ["a", "b", "c"]);
      expect(websites.lookups).toEqual([WEBSITE_UUID]);
    });

    // The endpoint answers 204 whether it removed all or none, so one already-gone
    // id must not abort the rest.
    it("continues past an id that no longer exists", async () => {
      repo.rows.push(makeRow({ id: "b" }));

      await service.bulkDelete(WEBSITE_UUID, ["missing", "b"]);

      expect(repo.deleted.map(([, id]) => id)).toEqual(["missing", "b"]);
    });

    it("accepts an empty batch without touching the repository", async () => {
      await service.bulkDelete(WEBSITE_UUID, []);
      expect(repo.deleted).toEqual([]);
    });
  });

  describe("toggle", () => {
    it("flips the active flag", async () => {
      repo.rows.push(makeRow({ isActive: true }));

      const toggled = await service.toggle(WEBSITE_UUID, "auto_1");
      expect(toggled?.isActive).toBe(false);
    });

    it("returns null for an unknown automation", async () => {
      expect(await service.toggle(WEBSITE_UUID, "nope")).toBeNull();
    });
  });

  describe("activeFor", () => {
    it("returns only active automations", async () => {
      repo.rows.push(makeRow({ id: "on", isActive: true }), makeRow({ id: "off", isActive: false }));

      const active = await service.activeFor(WEBSITE_UUID);
      expect(active.map((a) => a.id)).toEqual(["on"]);
    });
  });
});
