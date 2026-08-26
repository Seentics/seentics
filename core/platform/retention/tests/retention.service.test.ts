import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { AppConfig } from "../../../config";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../interfaces";

/**
 * The websites list is the one table retention reads directly. Stubbed here so the
 * orchestration — policy merging, per-website iteration, failure isolation — can be
 * tested without a database.
 *
 * Must export everything `db/index.ts` does: Bun's module mocks are process-global, so
 * a partial stub becomes the `db` module for every later test file.
 */
const websiteRows: { id: string; website_id: string }[] = [];

/**
 * The site list arrives through `RetentionSiteSource` now, so this no longer has to
 * mock the database module to control it — the sweep never touches `websites` itself.
 */
const siteSource = {
  async listAllSites() {
    return websiteRows.map((r) => ({ websiteId: r.id}));
  },
};

mock.module("../../../db", () => ({
  sql: mock(async () => websiteRows),
  db: {},
  analyticsEvents: {},
  outbox: {},
  websites: {},
  websiteMembers: {},
}));

const overrideRows = new Map<string, Record<string, number>>();
mock.module("../overrides", () => ({
  fetchRetentionOverrides: mock(async () => overrideRows),
}));

mock.module("../../lib/logger", () => {
  const logger: Record<string, unknown> = {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
  logger.child = () => logger;
  return { log: logger };
});

const { RetentionService } = await import("../retention.service");

/** Records what it was asked to delete, and can be made to fail. */
class FakePurge implements RetentionPurge {
  calls: { target: RetentionTarget; cutoffs: RetentionCutoffs; options: RetentionOptions }[] = [];
  failing = false;

  constructor(
    readonly name: string,
    private readonly counts: Record<string, number> = { rows: 1 },
  ) {}

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    options: RetentionOptions,
  ): Promise<Record<string, number>> {
    this.calls.push({ target, cutoffs, options });
    if (this.failing) throw new Error(`${this.name} exploded`);
    return this.counts;
  }
}

function cfg(overrides: Partial<AppConfig["dataRetention"]> = {}): AppConfig {
  return {
    dataRetention: {
      enabled: true,
      analyticsDays: 365,
      replayDays: 30,
      heatmapDays: 90,
      funnelAutomationDays: 180,
      replayDeleteBatchSize: 500,
      cronExpression: "15 4 * * *",
      ...overrides,
    },
    s3: { bucket: "test-bucket" },
  } as unknown as AppConfig;
}

const DAY = 86_400_000;

describe("RetentionService", () => {
  beforeEach(() => {
    websiteRows.length = 0;
    overrideRows.clear();
  });

  describe("enablement", () => {
    it("does nothing when retention is disabled", async () => {
      const purge = new FakePurge("analytics");
      websiteRows.push({ id: "u1", website_id: "s1" });

      const stats = await new RetentionService(siteSource, [purge]).runSafely(cfg({ enabled: false }));

      expect(stats).toBeNull();
      expect(purge.calls).toEqual([]);
    });
  });

  describe("iteration", () => {
    it("purges every website through every purger", async () => {
      const a = new FakePurge("analytics");
      const b = new FakePurge("heatmaps");
      websiteRows.push({ id: "u1", website_id: "s1" }, { id: "u2", website_id: "s2" });

      const stats = await new RetentionService(siteSource, [a, b]).runSafely(cfg());

      expect(stats?.websitesProcessed).toBe(2);
      expect(a.calls).toHaveLength(2);
      expect(b.calls).toHaveLength(2);
    });

    // Both identifiers are handed over because the tables are keyed differently:
    // analytics_events by website_id, heatmap_points by the UUID.
    it("passes both identifiers for each website", async () => {
      const purge = new FakePurge("analytics");
      websiteRows.push({ id: "uuid-1", website_id: "site-1" });

      await new RetentionService(siteSource, [purge]).runSafely(cfg());

      expect(purge.calls[0]?.target).toEqual({ websiteId: "uuid-1"});
    });

    it("reports zero websites processed when there are none", async () => {
      const stats = await new RetentionService(siteSource, [new FakePurge("a")]).runSafely(cfg());
      expect(stats?.websitesProcessed).toBe(0);
    });
  });

  describe("cut-offs", () => {
    it("derives one cut-off per data kind from the configured days", async () => {
      const purge = new FakePurge("analytics");
      websiteRows.push({ id: "u1", website_id: "s1" });

      const before = Date.now();
      await new RetentionService(siteSource, [purge]).runSafely(cfg());
      const cutoffs = purge.calls[0]!.cutoffs;

      // Each is `now - days`, within a second of when the sweep started.
      const approx = (d: Date, days: number) =>
        Math.abs(before - days * DAY - d.getTime()) < 1000;

      expect(approx(cutoffs.analytics, 365)).toBe(true);
      expect(approx(cutoffs.funnelAutomation, 180)).toBe(true);
      expect(approx(cutoffs.replay, 30)).toBe(true);
      expect(approx(cutoffs.heatmap, 90)).toBe(true);
    });

    // Per-website overrides are the reason retention owns policy at all.
    it("lets a per-website override win over the deployment default", async () => {
      const purge = new FakePurge("analytics");
      websiteRows.push({ id: "u1", website_id: "s1" });
      overrideRows.set("u1", { analytics_days: 7 });

      const before = Date.now();
      await new RetentionService(siteSource, [purge]).runSafely(cfg());
      const cutoffs = purge.calls[0]!.cutoffs;

      expect(Math.abs(before - 7 * DAY - cutoffs.analytics.getTime())).toBeLessThan(1000);
      // Unoverridden kinds keep the default.
      expect(Math.abs(before - 30 * DAY - cutoffs.replay.getTime())).toBeLessThan(1000);
    });

    it("applies an override only to the website it names", async () => {
      const purge = new FakePurge("analytics");
      websiteRows.push({ id: "u1", website_id: "s1" }, { id: "u2", website_id: "s2" });
      overrideRows.set("u1", { analytics_days: 7 });

      await new RetentionService(siteSource, [purge]).runSafely(cfg());

      const [first, second] = purge.calls;
      expect(first!.cutoffs.analytics.getTime()).toBeGreaterThan(
        second!.cutoffs.analytics.getTime(),
      );
    });
  });

  describe("batch size", () => {
    it("clamps a too-small batch size up to the floor", async () => {
      const purge = new FakePurge("recordings");
      websiteRows.push({ id: "u1", website_id: "s1" });

      await new RetentionService(siteSource, [purge]).runSafely(cfg({ replayDeleteBatchSize: 1 }));
      expect(purge.calls[0]?.options.batchSize).toBe(50);
    });

    // Unbounded would hold a transaction open across thousands of storage deletes.
    it("clamps a too-large batch size down to the ceiling", async () => {
      const purge = new FakePurge("recordings");
      websiteRows.push({ id: "u1", website_id: "s1" });

      await new RetentionService(siteSource, [purge]).runSafely(cfg({ replayDeleteBatchSize: 999_999 }));
      expect(purge.calls[0]?.options.batchSize).toBe(2000);
    });

    it("passes the bucket through", async () => {
      const purge = new FakePurge("recordings");
      websiteRows.push({ id: "u1", website_id: "s1" });

      await new RetentionService(siteSource, [purge]).runSafely(cfg());
      expect(purge.calls[0]?.options.bucket).toBe("test-bucket");
    });
  });

  describe("stats", () => {
    it("sums each metric across websites", async () => {
      const purge = new FakePurge("analytics", { analyticsGeneralRows: 3 });
      websiteRows.push({ id: "u1", website_id: "s1" }, { id: "u2", website_id: "s2" });

      const stats = await new RetentionService(siteSource, [purge]).runSafely(cfg());
      expect(stats?.analyticsGeneralRows).toBe(6);
    });

    it("merges metrics from different purgers", async () => {
      websiteRows.push({ id: "u1", website_id: "s1" });
      const stats = await new RetentionService(siteSource, [
        new FakePurge("analytics", { analyticsGeneralRows: 2 }),
        new FakePurge("heatmaps", { heatmapPointRows: 5 }),
      ]).runSafely(cfg());

      expect(stats).toMatchObject({ analyticsGeneralRows: 2, heatmapPointRows: 5 });
    });
  });

  /**
   * The behaviour that matters most operationally: the previous single-function sweep
   * ran everything inline, so one site's unreachable S3 prefix could abandon the rest.
   */
  describe("failure isolation", () => {
    it("continues to the next purger when one throws", async () => {
      const failing = new FakePurge("recordings");
      failing.failing = true;
      const healthy = new FakePurge("heatmaps", { heatmapPointRows: 4 });
      websiteRows.push({ id: "u1", website_id: "s1" });

      const stats = await new RetentionService(siteSource, [failing, healthy]).runSafely(cfg());

      expect(healthy.calls).toHaveLength(1);
      expect(stats?.heatmapPointRows).toBe(4);
    });

    it("continues to the next website after a failure", async () => {
      const failing = new FakePurge("recordings");
      failing.failing = true;
      websiteRows.push({ id: "u1", website_id: "s1" }, { id: "u2", website_id: "s2" });

      const stats = await new RetentionService(siteSource, [failing]).runSafely(cfg());

      expect(failing.calls).toHaveLength(2);
      expect(stats?.websitesProcessed).toBe(2);
    });

    it("still resolves rather than rejecting", async () => {
      const failing = new FakePurge("recordings");
      failing.failing = true;
      websiteRows.push({ id: "u1", website_id: "s1" });

      await expect(new RetentionService(siteSource, [failing]).runSafely(cfg())).resolves.toBeTruthy();
    });
  });

  // The cron and the manual /internal trigger can both fire; two concurrent sweeps
  // would race on the same batches.
  describe("single flight", () => {
    it("refuses a second concurrent sweep", async () => {
      websiteRows.push({ id: "u1", website_id: "s1" });

      let release: (() => void) | undefined;
      const slow: RetentionPurge = {
        name: "slow",
        purge: async () => {
          await new Promise<void>((r) => (release = r));
          return {};
        },
      };
      const service = new RetentionService(siteSource, [slow]);

      const first = service.runSafely(cfg());
      await new Promise((r) => setTimeout(r, 5));
      const second = await service.runSafely(cfg());

      expect(second).toBeNull();

      release?.();
      await first;
    });

    it("allows a sweep after the previous one finishes", async () => {
      websiteRows.push({ id: "u1", website_id: "s1" });
      const service = new RetentionService(siteSource, [new FakePurge("a")]);

      await service.runSafely(cfg());
      expect(await service.runSafely(cfg())).toBeTruthy();
    });

    // The flag must clear even when the sweep throws, or one failure wedges retention
    // shut for the lifetime of the process.
    it("clears the in-flight flag when a sweep throws", async () => {
      websiteRows.push({ id: "u1", website_id: "s1" });
      const exploding: RetentionPurge = {
        name: "boom",
        purge: async () => {
          throw new Error("nope");
        },
      };
      const service = new RetentionService(siteSource, [exploding]);

      await service.runSafely(cfg());
      expect(await service.runSafely(cfg())).toBeTruthy();
    });
  });
});
