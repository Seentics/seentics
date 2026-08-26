import { describe, expect, it } from "bun:test";
import type { Website, WebsiteQuery, WebsiteRole } from "../../../modules/websites/interfaces";
import type { UsageCounter, UsageScope } from "../interfaces";
import { UserUsageService } from "../usage.service";

const USER = "11111111-2222-3333-4444-555555555555";

function website(id: string): Website {
  return {
    id,
    ownerId: USER,
    name: "site",
    url: "https://example.com",
    trackingId: "t",
    isActive: true,
    isVerified: true,
    automationEnabled: true,
    funnelEnabled: true,
    heatmapEnabled: true,
    heatmapIncludePatterns: null,
    heatmapExcludePatterns: null,
    heatmapLayoutEnabled: false,
    replayEnabled: true,
    replaySamplingRate: 1,
    replayIncludePatterns: null,
    replayExcludePatterns: null,
    verificationToken: "v",
    publicShareId: null,
    settings: {} as Website["settings"],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function websitesStub(owned: Website[]): WebsiteQuery {
  return {
    async getById() { return null; },
    async listOwnedBy() { return owned; },
    async getRole(): Promise<WebsiteRole | null> { return "owner"; },
  };
}

/** Records the scope it was handed, so tests can assert on what the reporter resolved. */
class SpyCounter implements UsageCounter {
  seen: UsageScope | null = null;
  constructor(readonly key: string, private readonly value: number) {}
  async countForUser(scope: UsageScope): Promise<number> {
    this.seen = scope;
    return this.value;
  }
}

class ThrowingCounter implements UsageCounter {
  constructor(readonly key: string) {}
  async countForUser(): Promise<number> {
    throw new Error("module is down");
  }
}

describe("UserUsageService", () => {
  /**
   * The response keys are consumed by the billing gateway, so they are an external
   * contract rather than an implementation detail. A module renaming its counter would
   * silently drop a field from the report.
   */
  it("reports one field per counter, keyed by the counter's key", async () => {
    const svc = new UserUsageService(websitesStub([website("w-1")]), [
      new SpyCounter("websites", 1),
      new SpyCounter("funnels", 2),
      new SpyCounter("automations", 3),
      new SpyCounter("heatmaps", 4),
      new SpyCounter("replays", 5),
      new SpyCounter("monthly_events", 6),
      new SpyCounter("ai_analyses", 7),
    ]);

    expect(await svc.countForUser(USER)).toEqual({
      websites: 1,
      funnels: 2,
      automations: 3,
      heatmaps: 4,
      replays: 5,
      monthly_events: 6,
      ai_analyses: 7,
    });
  });

  /**
   * Resolved once, for everyone. Four of the original seven queries each re-ran the
   * same `websites` subquery; the point of the scope is that they no longer have to —
   * and that no counter needs to touch that table.
   */
  it("resolves the scope once and hands the same ids to every counter", async () => {
    const a = new SpyCounter("a", 0);
    const b = new SpyCounter("b", 0);
    const svc = new UserUsageService(
      websitesStub([website("uuid-1"), website("uuid-2")]),
      [a, b],
    );

    await svc.countForUser(USER);

    for (const spy of [a, b]) {
      expect(spy.seen?.websiteIds).toEqual(["uuid-1", "uuid-2"]);
      expect(spy.seen?.userId).toBe(USER);
    }
  });

  it("scopes month-bounded counts to the first of the month, UTC", async () => {
    const spy = new SpyCounter("a", 0);
    await new UserUsageService(websitesStub([]), [spy]).countForUser(USER);

    const start = spy.seen!.monthStart;
    expect(start.getUTCDate()).toBe(1);
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
    expect(start.getUTCMilliseconds()).toBe(0);
  });

  /**
   * A malformed id used to be interpolated into seven queries. All-zeros is the right
   * answer, and it must still carry every key so the caller's shape does not change.
   */
  it("returns all-zeros without querying when the user id is not a UUID", async () => {
    const spy = new SpyCounter("websites", 99);
    const svc = new UserUsageService(websitesStub([website("w")]), [spy]);

    expect(await svc.countForUser("'; DROP TABLE websites; --")).toEqual({ websites: 0 });
    expect(spy.seen).toBeNull();
  });

  /**
   * One module failing must not blank the other six: this feeds billing dashboards,
   * and a partial report is far more useful than a 500.
   */
  it("reports zero for a failing counter and keeps the rest", async () => {
    const svc = new UserUsageService(websitesStub([website("w")]), [
      new SpyCounter("funnels", 4),
      new ThrowingCounter("heatmaps"),
      new SpyCounter("replays", 6),
    ]);

    expect(await svc.countForUser(USER)).toEqual({ funnels: 4, heatmaps: 0, replays: 6 });
  });

  it("clamps a negative count to zero", async () => {
    const svc = new UserUsageService(websitesStub([]), [new SpyCounter("funnels", -5)]);
    expect(await svc.countForUser(USER)).toEqual({ funnels: 0 });
  });
});
