import { describe, it, expect, mock, beforeAll } from "bun:test";
import type { WebsiteTrackerRow, TrackerGoal } from "../interfaces";

// website-for-tracker.ts imports `sql` from "../../../db" at the module level.
// Mock the DB before dynamically importing the module.
mock.module("../../../db", () => ({
  sql: mock(async () => []),
  db: {
    insert: mock(() => ({ values: mock(async () => {}) })),
    transaction: mock(async (fn: (tx: any) => Promise<void>) => fn({ insert: mock(() => ({ values: mock(async () => {}) })) })),
  },
  analyticsEvents: {},
}));

let buildPublicTrackerConfig: (w: WebsiteTrackerRow, goals: TrackerGoal[]) => Promise<Record<string, unknown>>;

beforeAll(async () => {
  const mod = await import("../repositories/tracker-website.repository");
  buildPublicTrackerConfig = mod.buildPublicTrackerConfig;
});

function makeWebsite(overrides: Partial<WebsiteTrackerRow> = {}): WebsiteTrackerRow {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    user_id: "user1",
    url: "https://example.com",
    is_active: true,
    funnel_enabled: true,
    heatmap_enabled: true,
    heatmap_include_patterns: null,
    heatmap_exclude_patterns: null,
    heatmap_layout_enabled: false,
    replay_enabled: true,
    replay_sampling_rate: 0.5,
    replay_include_patterns: null,
    replay_exclude_patterns: null,
    automation_enabled: true,
    ...overrides,
  };
}

function makeGoal(overrides: Partial<TrackerGoal> = {}): TrackerGoal {
  return { id: "goal_1", name: "signup_click", selector: "#signup-btn", ...overrides };
}

describe("buildPublicTrackerConfig", () => {
  it("includes the website_id", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite(), []);
    expect(cfg.website_id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("exposes funnel_enabled flag", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ funnel_enabled: false }), []);
    expect(cfg.funnel_enabled).toBe(false);
  });

  it("exposes replay_enabled and replay_sampling_rate", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ replay_enabled: true, replay_sampling_rate: 0.25 }), []);
    expect(cfg.replay_enabled).toBe(true);
    expect(cfg.replay_sampling_rate).toBe(0.25);
  });

  it("exposes heatmap_enabled and heatmap_layout_enabled", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ heatmap_enabled: false, heatmap_layout_enabled: true }), []);
    expect(cfg.heatmap_enabled).toBe(false);
    expect(cfg.heatmap_layout_enabled).toBe(true);
  });

  it("maps goals array with id, name, selector", async () => {
    const goals = [makeGoal({ id: "g1", name: "btn_click", selector: "#btn" })];
    const cfg = await buildPublicTrackerConfig(makeWebsite(), goals);
    expect(cfg.goals).toEqual([{ id: "g1", name: "btn_click", selector: "#btn" }]);
  });

  it("returns empty goals array when no goals", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite(), []);
    expect(cfg.goals).toEqual([]);
  });

  it("maps multiple goals in order", async () => {
    const goals = [makeGoal({ id: "g1" }), makeGoal({ id: "g2" }), makeGoal({ id: "g3" })];
    const cfg = await buildPublicTrackerConfig(makeWebsite(), goals);
    expect((cfg.goals as any[]).map((g) => g.id)).toEqual(["g1", "g2", "g3"]);
  });

  it("omits heatmap_include_patterns when null", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ heatmap_include_patterns: null }), []);
    expect(cfg).not.toHaveProperty("heatmap_include_patterns");
  });

  it("includes heatmap_include_patterns when set", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ heatmap_include_patterns: "/blog/*" }), []);
    expect(cfg.heatmap_include_patterns).toBe("/blog/*");
  });

  it("omits heatmap_exclude_patterns when null", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ heatmap_exclude_patterns: null }), []);
    expect(cfg).not.toHaveProperty("heatmap_exclude_patterns");
  });

  it("includes heatmap_exclude_patterns when set", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ heatmap_exclude_patterns: "/admin/*" }), []);
    expect(cfg.heatmap_exclude_patterns).toBe("/admin/*");
  });

  it("exposes replay_include_patterns when set", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ replay_include_patterns: "/checkout/*" }), []);
    expect(cfg.replay_include_patterns).toBe("/checkout/*");
  });

  it("exposes null replay_exclude_patterns as null", async () => {
    const cfg = await buildPublicTrackerConfig(makeWebsite({ replay_exclude_patterns: null }), []);
    expect(cfg.replay_exclude_patterns).toBeNull();
  });
});
