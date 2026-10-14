import { describe, expect, it } from "bun:test";

// The goal and site-settings ports import the database client, which needs a URL to construct; nothing connects.
process.env.DATABASE_URL ??= "postgres://test-not-connected";
const { GoalDraftService } = await import("../../websites/lib/goal-drafts");
const { SiteSettingsDraftService } = await import("../../websites/lib/site-settings-drafts");
import { AutomationDraftValidatorService } from "../../automations/lib/draft-validator";
import { AutomationDraftWriterService } from "../../automations/lib/draft-writer";
import { FunnelDraftService } from "../../funnels/lib/funnel-drafts";
import type { AutomationSnapshot } from "../../automations/interfaces/automations.module";
import type { FunnelSnapshot } from "../../funnels/interfaces";
import type { GoalSnapshot, SiteTrackingSettings, Website } from "../../websites/interfaces";
import { ToolRegistry } from "../tools/registry";
import { applyAutomationPatch, automationEditTools } from "../tools/propose-automation-edit.tool";
import { proposeAutomationTool } from "../tools/propose-automation.tool";
import { funnelEditTools } from "../tools/propose-funnel-edit.tool";
import { goalEditTools } from "../tools/propose-goal.tool";
import { alertTools, errorTriageTool, recommendationTriageTool } from "../tools/propose-triage.tool";
import { dataImpact, siteSettingsTools } from "../tools/propose-site-settings.tool";
import { proposalWriters } from "../services/agent/proposal-writers";
import type { ActionProposal } from "../tools/tool.types";
import type { AlertSettings } from "../anomalies/types";

const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const AUTO = "33333333-3333-4333-8333-333333333333";
const FUNNEL = "44444444-4444-4444-8444-444444444444";
const GOAL = "55555555-5555-4555-8555-555555555555";
const CLICK_GOAL = "66666666-6666-4666-8666-666666666666";
const REC = "77777777-7777-4777-8777-777777777777";
const ANOMALY = "88888888-8888-4888-8888-888888888888";
const V1 = "2026-10-01T10:00:00.000Z";
const ctx = { websiteId: SITE, userId: "u1" };

const proposalOf = (r: { ok: boolean }) => (r as unknown as { data: { proposal: ActionProposal } }).data.proposal;
const errorOf = (r: { ok: boolean }) => (r as unknown as { error: string }).error;

// ─── Automations ────────────────────────────────────────────────────────────────

const definition = {
  triggers: [{ type: "exit_intent" }],
  graph: {
    entry: "n_if",
    nodes: [
      { id: "n_if", kind: "if", group: { operator: "AND", rules: [{ fact: "page.path", operator: "equals", value: "/pricing" }] } },
      { id: "n_action", kind: "action", action: { type: "show_modal", title: "Wait!", message: "10% off", custom_html: "x".repeat(1000) } },
      { id: "n_else", kind: "action", action: { type: "show_toast", message: "Hi" } },
    ],
    edges: [{ from: "n_if", to: "n_action", branch: "true" }, { from: "n_if", to: "n_else", branch: "false" }],
  },
};

const snapshots = new Map<string, AutomationSnapshot & { websiteId: string }>([
  [AUTO, { id: AUTO, websiteId: SITE, name: "Exit offer", isActive: true, definition, version: V1 }],
]);
const automationPort = {
  async get(websiteId: string, id: string) {
    const s = snapshots.get(id);
    return s && s.websiteId === websiteId ? s : null;
  },
};
const validator = new AutomationDraftValidatorService();
const autoRegistry = new ToolRegistry([
  proposeAutomationTool(validator, validator.vocabulary()),
  ...automationEditTools({ automations: automationPort, validator }),
]);

describe("automation drafts", () => {
  it("get_automation cuts long strings and keeps ids", async () => {
    const r = await autoRegistry.run("get_automation", { automationId: AUTO }, ctx);
    const data = (r as any).data.data;
    expect(data.id).toBe(AUTO);
    expect(data.graph.nodes[1].id).toBe("n_action");
    expect(data.graph.nodes[1].action.custom_html.length).toBeLessThan(400);
  });

  it("refuses a malformed id and an automation of another website", async () => {
    expect(errorOf(await autoRegistry.run("propose_automation_update", { automationId: "1; drop", patch: { name: "x" } }, ctx))).toContain("Not an automation id");
    const other = await autoRegistry.run("propose_automation_update", { automationId: AUTO, patch: { name: "x" } }, { websiteId: OTHER, userId: "u1" });
    expect(errorOf(other)).toContain("No automation with that id on this website");
  });

  it("drafts an action edit with a diff, the stored version, and the live callout", async () => {
    const r = await autoRegistry.run("propose_automation_update", {
      automationId: AUTO,
      patch: { actionUpdates: [{ nodeId: "n_action", changes: { message: "15% off" } }] },
    }, ctx);
    expect(r.ok).toBe(true);
    const p = proposalOf(r);
    expect(p).toMatchObject({ resource: "automation", operation: "update", target: { id: AUTO, version: V1 }, requiredRole: "member" });
    expect(p.diff).toEqual([{ field: "actions", label: "Actions", before: ["show modal: Wait! — 10% off", "show toast: Hi"], after: ["show modal: Wait! — 15% off", "show toast: Hi"] }]);
    const action = ((p.payload as any).definition.graph.nodes[1]).action;
    expect(action.message).toBe("15% off");
    // Custom code the model never saw in full is kept.
    expect(action.custom_html).toHaveLength(1000);
    expect(p.summary.risks?.map((x) => x.kind)).toContain("live");
  });

  it("restores a truncated string sent back unchanged", () => {
    const merged = applyAutomationPatch(definition, { actionUpdates: [{ nodeId: "n_action", changes: { custom_html: "xxx…[truncated 700 chars]", message: "new" } }] });
    expect(merged.ok && (merged.definition.graph!.nodes![1]!.action as any).custom_html).toHaveLength(1000);
  });

  it("refuses an invalid patch: unknown node, bad trigger, broken condition, and no change", async () => {
    expect(errorOf(await autoRegistry.run("propose_automation_update", { automationId: AUTO, patch: { actionUpdates: [{ nodeId: "nope", changes: {} }] } }, ctx))).toContain("No action node");
    expect(errorOf(await autoRegistry.run("propose_automation_update", { automationId: AUTO, patch: { triggers: [{ type: "telepathy" }] } }, ctx))).toContain("not valid");
    expect(errorOf(await autoRegistry.run("propose_automation_update", { automationId: AUTO, patch: { conditionUpdates: [{ nodeId: "n_if", group: { operator: "XOR", rules: [] } }] } }, ctx))).toContain("not valid");
    expect((await autoRegistry.run("propose_automation_update", { automationId: AUTO, patch: {} }, ctx)).ok).toBe(false);
    expect((await autoRegistry.run("propose_automation_update", { automationId: AUTO, patch: { name: "Exit offer" } }, ctx)).ok).toBe(false);
  });

  it("drafts a condition change with before and after", async () => {
    const r = await autoRegistry.run("propose_automation_update", {
      automationId: AUTO,
      patch: { conditionUpdates: [{ nodeId: "n_if", group: { operator: "AND", rules: [{ fact: "page.path", operator: "equals", value: "/checkout" }] } }] },
    }, ctx);
    const d = proposalOf(r).diff!.find((x) => x.field === "conditions")!;
    expect(d.before).toEqual(['if (page.path equals "/pricing")']);
    expect(d.after).toEqual(['if (page.path equals "/checkout")']);
  });

  it("drafts switching off with a stops callout, and refuses a no-op", async () => {
    const r = await autoRegistry.run("propose_automation_status", { automationId: AUTO, active: false }, ctx);
    expect(proposalOf(r)).toMatchObject({ operation: "set_status", payload: { active: false }, target: { version: V1 } });
    expect(proposalOf(r).summary.risks?.[0]?.kind).toBe("stops");
    expect((await autoRegistry.run("propose_automation_status", { automationId: AUTO, active: true }, ctx)).ok).toBe(false);
  });

  it("create defaults to inactive; activate: true says it goes live immediately", async () => {
    const base = { name: "Hi", trigger: "page_view", action: "show_toast", actionConfig: { message: "hi" } };
    const off = proposalOf(await autoRegistry.run("propose_automation", base, ctx));
    expect((off.payload as any).activate).toBe(false);
    expect(off.summary.risks ?? []).toHaveLength(0);
    const on = proposalOf(await autoRegistry.run("propose_automation", { ...base, activate: true }, ctx));
    expect((on.payload as any).activate).toBe(true);
    expect(on.summary.risks?.[0]?.message).toContain("go live immediately");
  });
});

describe("AutomationDraftWriterService", () => {
  const calls: unknown[] = [];
  const row = { id: AUTO, websiteId: SITE, userId: "u", name: "n", definition, isActive: false, priority: 0, status: "", createdAt: new Date(), updatedAt: new Date(V1) };
  const writer = new AutomationDraftWriterService({
    create: async (w, u, input) => { calls.push(["create", input]); return { ...row }; },
    get: async (w, id) => (w === SITE && id === AUTO ? { ...row } : null),
    update: async (w, id, patch) => { calls.push(["update", patch]); return w === SITE && id === AUTO ? { ...row } : null; },
  });

  it("creates inactive unless the draft asked to activate", async () => {
    await writer.createFromProposal({ websiteId: SITE, userId: "u", payload: { name: "a", definition } });
    await writer.createFromProposal({ websiteId: SITE, userId: "u", payload: { name: "a", definition, activate: true } });
    expect((calls[0] as any)[1].is_active).toBe(false);
    expect((calls[1] as any)[1].is_active).toBe(true);
  });

  it("re-validates an update with the endpoint's schema, and never flips status as a side effect", async () => {
    await expect(writer.updateFromProposal({ websiteId: SITE, automationId: AUTO, payload: { definition: { triggers: [] } } })).rejects.toThrow("not valid");
    calls.length = 0;
    await writer.updateFromProposal({ websiteId: SITE, automationId: AUTO, payload: { name: "b", enabled: true } });
    expect(calls).toEqual([["update", { name: "b" }]]);
  });

  it("reports a version, and throws for an automation that is gone", async () => {
    expect((await writer.get(SITE, AUTO))?.version).toBe(V1);
    expect(await writer.get(OTHER, AUTO)).toBeNull();
    await expect(writer.setActiveFromProposal({ websiteId: OTHER, automationId: AUTO, active: true })).rejects.toThrow("no longer exists");
  });
});

// ─── Funnels ───────────────────────────────────────────────────────────────────

const funnelRow = {
  id: FUNNEL, website_id: SITE, user_id: "u", name: "Signup", description: "", is_active: true,
  steps: [
    { id: "step-1", name: "Pricing", order: 0, step_type: "page_view", page_path: "/pricing", match_type: "exact" },
    { id: "step-2", name: "Signed up", order: 1, step_type: "event", event_type: "signup", match_type: "exact" },
  ],
  conversion_window_hours: null, created_at: V1, updated_at: V1,
  stats: { totalEntries: 0, completions: 0, conversionRate: 0, stepBreakdown: [] },
};
const funnelUpdates: unknown[] = [];
const funnels = new FunnelDraftService({
  create: async () => { throw new Error("no"); },
  get: async (w, id) => (w === SITE && id === FUNNEL ? (funnelRow as any) : null),
  update: async (w, id, input) => { funnelUpdates.push(input); return w === SITE && id === FUNNEL ? (funnelRow as any) : null; },
}, async (p) => !p.includes("(?<"));
const funnelRegistry = new ToolRegistry(funnelEditTools(funnels));

describe("funnel drafts", () => {
  it("drafts a step change as a before/after list of steps", async () => {
    const r = await funnelRegistry.run("propose_funnel_update", {
      funnelId: FUNNEL,
      patch: { steps: [{ name: "Pricing", type: "page", value: "/pricing", match: "starts_with" }, { name: "Signed up", type: "event", value: "signup" }] },
    }, ctx);
    const p = proposalOf(r);
    expect(p).toMatchObject({ resource: "funnel", operation: "update", target: { id: FUNNEL, version: V1 } });
    expect(p.diff).toEqual([{
      field: "steps", label: "Steps",
      before: ["Pricing (page is /pricing)", 'Signed up (event "signup")'],
      after: ["Pricing (page starts with /pricing)", 'Signed up (event "signup")'],
    }]);
  });

  it("refuses a cross-site id, a one-step funnel, and a window over the limit", async () => {
    expect((await funnelRegistry.run("propose_funnel_update", { funnelId: FUNNEL, patch: { name: "x" } }, { websiteId: OTHER, userId: "u" })).ok).toBe(false);
    expect((await funnelRegistry.run("propose_funnel_update", { funnelId: FUNNEL, patch: { steps: [{ name: "a", type: "page", value: "/a" }] } }, ctx)).ok).toBe(false);
    expect((await funnelRegistry.run("propose_funnel_update", { funnelId: FUNNEL, patch: { conversionWindowHours: 5000 } }, ctx)).ok).toBe(false);
  });

  it("0 hours clears the window", async () => {
    funnelRow.conversion_window_hours = 24 as any;
    const p = proposalOf(await funnelRegistry.run("propose_funnel_update", { funnelId: FUNNEL, patch: { conversionWindowHours: 0 } }, ctx));
    expect((p.payload as any).conversion_window_hours).toBeNull();
    funnelRow.conversion_window_hours = null;
  });

  it("re-validates on confirm, against the funnel as it is now", async () => {
    await expect(funnels.updateFromProposal({ websiteId: SITE, funnelId: FUNNEL, payload: { steps: [] } })).rejects.toThrow("not valid");
    await expect(funnels.updateFromProposal({ websiteId: OTHER, funnelId: FUNNEL, payload: { name: "x" } })).rejects.toThrow("no longer exists");
  });

  it("drafts deactivation, never deletion", async () => {
    const p = proposalOf(await funnelRegistry.run("propose_funnel_status", { funnelId: FUNNEL, active: false }, ctx));
    expect(p).toMatchObject({ operation: "set_status", payload: { active: false } });
  });
});

// ─── Goals ─────────────────────────────────────────────────────────────────────

class FakeGoals extends GoalDraftService {
  goals: Record<string, GoalSnapshot & { websiteId: string }> = {
    [GOAL]: { id: GOAL, websiteId: SITE, name: "Signed up", type: "event", identifier: "signup", version: V1 },
    [CLICK_GOAL]: { id: CLICK_GOAL, websiteId: SITE, name: "Buy click", type: "click", identifier: "buy", version: V1 },
  };
  override async list(websiteId: string) { return Object.values(this.goals).filter((g) => g.websiteId === websiteId); }
  override async get(websiteId: string, id: string) { const g = this.goals[id]; return g && g.websiteId === websiteId ? g : null; }
}
const goalRegistry = new ToolRegistry(goalEditTools(new FakeGoals()));

describe("goal drafts", () => {
  it("drafts a change of what completes a goal, normalising the path", async () => {
    const p = proposalOf(await goalRegistry.run("propose_goal_update", { goalId: GOAL, patch: { type: "pageview", identifier: "thanks" } }, ctx));
    expect(p.payload).toEqual({ type: "pageview", identifier: "/thanks" });
    expect(p.diff).toEqual([{ field: "completes", label: "Completed by", before: 'event "signup"', after: "page /thanks" }]);
  });

  it("only renames a click goal, and refuses ids from another site", async () => {
    expect(errorOf(await goalRegistry.run("propose_goal_update", { goalId: CLICK_GOAL, patch: { identifier: "/x" } }, ctx))).toContain("only be renamed");
    expect(proposalOf(await goalRegistry.run("propose_goal_update", { goalId: CLICK_GOAL, patch: { name: "Buy" } }, ctx)).payload).toEqual({ name: "Buy" });
    expect((await goalRegistry.run("propose_goal_update", { goalId: GOAL, patch: { name: "x" } }, { websiteId: OTHER, userId: "u" })).ok).toBe(false);
  });

  it("lists goals with their ids", async () => {
    const r = await goalRegistry.run("list_goals", {}, ctx);
    expect((r as any).data.data.map((g: any) => g.id)).toEqual([GOAL, CLICK_GOAL]);
  });
});

// ─── Triage ────────────────────────────────────────────────────────────────────

describe("triage drafts", () => {
  const group = { id: "g", fingerprint: "fp1", kind: "error", message: "TypeError: x is undefined", source_file: "", line_no: null, status: "unresolved", event_count: 12, last_page_path: "/cart", first_seen: V1, last_seen: V1 };
  const errorRegistry = new ToolRegistry([errorTriageTool({
    getGroup: async (w, fp) => ({ group: w === SITE && fp === "fp1" ? group : null, samples: [] }),
  })]);

  it("drafts an error status change, versioned by its status", async () => {
    const p = proposalOf(await errorRegistry.run("propose_error_status", { fingerprint: "fp1", status: "resolved" }, ctx));
    expect(p).toMatchObject({ resource: "error", operation: "set_status", target: { id: "fp1", version: "unresolved" }, payload: { status: "resolved" }, requiredRole: "member" });
    expect((await errorRegistry.run("propose_error_status", { fingerprint: "fp1", status: "unresolved" }, ctx)).ok).toBe(false);
    expect((await errorRegistry.run("propose_error_status", { fingerprint: "fp1", status: "resolved" }, { websiteId: OTHER, userId: "u" })).ok).toBe(false);
    expect((await errorRegistry.run("propose_error_status", { fingerprint: "fp1", status: "deleted" }, ctx)).ok).toBe(false);
  });

  it("drafts dismissing an open recommendation only", async () => {
    const reg = new ToolRegistry([recommendationTriageTool({
      get: async (w, id) => (w === SITE && id === REC ? ({ id: REC, title: "Fix /pricing", status: "open" } as any) : null),
    })]);
    expect(proposalOf(await reg.run("propose_recommendation_status", { id: REC, status: "dismissed" }, ctx))).toMatchObject({ target: { id: REC, version: "open" } });
    expect((await reg.run("propose_recommendation_status", { id: "nope", status: "dismissed" }, ctx)).ok).toBe(false);
    expect((await reg.run("propose_recommendation_status", { id: REC, status: "dismissed" }, { websiteId: OTHER, userId: "u" })).ok).toBe(false);
  });

  const settings: AlertSettings = { enabled: true, sensitivity: "normal" };
  const alertReg = new ToolRegistry(alertTools({
    list: async () => [],
    get: async (w, id) => (w === SITE && id === ANOMALY ? ({ id: ANOMALY, title: "Traffic dropped 60%", type: "traffic_drop" } as any) : null),
    settings: async () => settings,
    snoozes: async () => [],
  }));

  it("alert settings and snoozes need an admin", async () => {
    const s = proposalOf(await alertReg.run("propose_alert_settings", { enabled: false }, ctx));
    expect(s).toMatchObject({ resource: "alert_settings", operation: "update", requiredRole: "admin", target: { id: SITE, version: "on:normal" }, payload: { enabled: false } });
    expect(s.summary.risks?.[0]?.message).toContain("Nobody");
    expect((await alertReg.run("propose_alert_settings", { sensitivity: "normal" }, ctx)).ok).toBe(false);

    const z = proposalOf(await alertReg.run("propose_alert_snooze", { anomalyId: ANOMALY, hours: 24 }, ctx));
    expect(z).toMatchObject({ resource: "alert_snooze", operation: "create", requiredRole: "admin", payload: { anomalyId: ANOMALY, hours: 24 } });
    expect((await alertReg.run("propose_alert_snooze", { anomalyId: ANOMALY, hours: 24 }, { websiteId: OTHER, userId: "u" })).ok).toBe(false);
    expect((await alertReg.run("propose_alert_snooze", { hours: 500 }, ctx)).ok).toBe(false);
    expect(proposalOf(await alertReg.run("propose_alert_snooze", { type: "error_surge", hours: 2 }, ctx)).payload).toEqual({ type: "error_surge", subject: "*", hours: 2 });
  });
});

// ─── Site settings ─────────────────────────────────────────────────────────────

const site: SiteTrackingSettings = {
  automation_enabled: true, funnel_enabled: true, errors_enabled: true,
  heatmap_enabled: true, heatmap_layout_enabled: true, heatmap_include_patterns: null, heatmap_exclude_patterns: null,
  replay_enabled: true, replay_sampling_rate: 1, replay_include_patterns: null, replay_exclude_patterns: "/checkout\n/account",
  mask_all_text: true, mask_text_patterns: null,
};

describe("site settings drafts", () => {
  const websiteRow = {
    id: SITE, updatedAt: new Date(V1), automationEnabled: true, funnelEnabled: true, errorsEnabled: true,
    heatmapEnabled: true, heatmapLayoutEnabled: true, heatmapIncludePatterns: null, heatmapExcludePatterns: null,
    replayEnabled: true, replaySamplingRate: 1, replayIncludePatterns: null, replayExcludePatterns: "/checkout\n/account",
    maskAllText: true, maskTextPatterns: null,
  } as unknown as Website;
  const updates: unknown[] = [];
  const port = new SiteSettingsDraftService(
    { getById: async (id) => (id === SITE ? websiteRow : null) },
    { update: async (id, input) => { updates.push(input); return id === SITE ? websiteRow : null; } },
  );
  const reg = new ToolRegistry(siteSettingsTools(port));

  it("says what a change does to the data collected", () => {
    const msgs = dataImpact(site, { replay_exclude_patterns: "/account", mask_all_text: false, replay_sampling_rate: 0.25 }).map((r) => r.message);
    expect(msgs).toContain("Recordings will start capturing /checkout.");
    expect(msgs).toContain("Recordings will capture 25% of sessions (was 100%).");
    expect(msgs.join(" ")).toContain("no longer be masked");
    expect(dataImpact(site, { automation_enabled: false })[0]).toMatchObject({ kind: "stops" });
  });

  it("drafts only the changed fields, for an admin, with the site's version", async () => {
    const p = proposalOf(await reg.run("propose_site_settings", { patch: { replay_exclude_patterns: "/account", replay_enabled: true } }, ctx));
    expect(p).toMatchObject({ resource: "site_settings", operation: "update", requiredRole: "admin", target: { id: SITE, version: V1 } });
    expect(p.payload).toEqual({ replay_exclude_patterns: "/account" });
    expect(p.diff?.[0]).toEqual({ field: "replay_exclude_patterns", label: "Never record pages matching", before: ["/checkout", "/account"], after: ["/account"] });
    expect(p.summary.risks?.[0]).toEqual({ kind: "data", message: "Recordings will start capturing /checkout." });
  });

  it("refuses an invalid patch and settings it does not cover", async () => {
    expect((await reg.run("propose_site_settings", { patch: { replay_sampling_rate: 5 } }, ctx)).ok).toBe(false);
    expect((await reg.run("propose_site_settings", { patch: { name: "Mine now" } }, ctx)).ok).toBe(false);
    expect(port.validatePatch({ url: "evil.test" }).ok).toBe(false);
    expect((await reg.run("propose_site_settings", { patch: {} }, ctx)).ok).toBe(false);
  });

  it("applies through the endpoint's patch mapping, and clears an emptied pattern list", async () => {
    await port.applyFromProposal({ websiteId: SITE, payload: { replay_exclude_patterns: "", replay_enabled: false } });
    expect(updates.at(-1)).toEqual({ replayEnabled: false, replayExcludePatterns: null });
    await expect(port.applyFromProposal({ websiteId: SITE, payload: { is_active: false } })).rejects.toThrow("not valid");
  });

  it("the writer only accepts the URL's website as the target", async () => {
    const w = proposalWriters({
      automations: {} as any, goals: {} as any, siteSettings: port,
      errors: { queries: { getGroup: async () => ({ group: null, samples: [] }) }, mutations: { setStatus: async () => true } },
    });
    expect(await w.site_settings!.version!(SITE, SITE)).toBe(V1);
    expect(await w.site_settings!.version!(SITE, OTHER)).toBeNull();
    expect(w.site_settings!.archive).toBeUndefined();
  });
});
