import { describe, expect, it } from "bun:test";

// The goal writer imports the database client, which needs a URL to construct; nothing connects.
process.env.DATABASE_URL ??= "postgres://test-not-connected";
const { GoalDraftService } = await import("../../websites/lib/goal-drafts");
import { ProposalApplier, type AppliedProposal } from "../services/agent/proposal-applier";
import type { AiRepository } from "../interfaces/ai-repository.interface";
import { buildSteps, proposeFunnelTool } from "../tools/propose-funnel.tool";
import { proposeGoalTool } from "../tools/propose-goal.tool";
import { recommendationTools, type RecommendationSummaryRow } from "../tools/recommendation-reads";
import { ToolRegistry } from "../tools/registry";
import { FunnelDraftService } from "../../funnels/lib/funnel-drafts";
import { buildReport } from "../recommendations/impact";
import type { Recommendation } from "../recommendations/types";

const USER = "user-1";
const SITE = "11111111-1111-4111-8111-111111111111";
const REC = "33333333-3333-4333-8333-333333333333";
const ctx = { websiteId: SITE, userId: USER };

function repoWith(proposal: Record<string, unknown>, recommendationId: string | null = null) {
  let applied = false;
  return {
    async pendingProposal() { return applied ? null : { websiteId: SITE, proposal, recommendationId }; },
    async markProposalApplied() { if (applied) return false; applied = true; return true; },
  } as unknown as AiRepository;
}

describe("ProposalApplier and recommendations", () => {
  it("tells the listener what was created and which recommendation it came from", async () => {
    const seen: AppliedProposal[] = [];
    const applier = new ProposalApplier(
      repoWith({ resource: "funnel", operation: "create", payload: { name: "Checkout" }, summary: { title: "Checkout" } }, REC),
      { createAutomation: async () => ({ id: "a" }), createFunnel: async () => ({ id: "funnel-1" }) },
      async (e) => { seen.push(e); },
    );
    const r = await applier.apply({ userId: USER, websiteId: SITE, queryId: "q1" });
    expect(r).toEqual({ ok: true, created: { resource: "funnel", id: "funnel-1" } });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ recommendationId: REC, queryId: "q1", created: { resource: "funnel", id: "funnel-1" } });
  });

  it("still reports success when recording the recommendation fails", async () => {
    const applier = new ProposalApplier(
      repoWith({ resource: "goal", operation: "create", payload: {} }),
      { createAutomation: async () => ({ id: "a" }), createGoal: async () => ({ id: "goal-1" }) },
      async () => { throw new Error("db down"); },
    );
    expect(await applier.apply({ userId: USER, websiteId: SITE, queryId: "q1" })).toEqual({ ok: true, created: { resource: "goal", id: "goal-1" } });
  });

  it("refuses a funnel draft where no funnel writer is wired, without burning it", async () => {
    const repo = repoWith({ resource: "funnel", operation: "create", payload: {} });
    const applier = new ProposalApplier(repo, { createAutomation: async () => ({ id: "a" }) });
    expect((await applier.apply({ userId: USER, websiteId: SITE, queryId: "q1" })).ok).toBe(false);
    // Still pending: the claim is only taken for a draft that will be written.
    expect(await repo.pendingProposal(USER, "q1")).not.toBeNull();
  });
});

describe("propose_funnel", () => {
  const drafts = new FunnelDraftService({ create: async () => { throw new Error("must not write"); } }, async (p) => !p.includes("(?<"));
  const registry = new ToolRegistry([proposeFunnelTool(drafts)]);

  it("drafts a funnel in the stored step shape and writes nothing", async () => {
    const r = await registry.run("propose_funnel", {
      name: "Signup",
      steps: [
        { name: "Pricing", type: "page", value: "pricing" },
        { name: "Signed up", type: "event", value: "signup" },
      ],
      conversionWindowHours: 24,
    }, ctx);
    expect(r.ok).toBe(true);
    const proposal = (r as any).data.proposal;
    expect(proposal.resource).toBe("funnel");
    expect(proposal.payload.steps).toEqual([
      { id: "step-1", name: "Pricing", order: 0, step_type: "page_view", page_path: "/pricing", match_type: "exact" },
      { id: "step-2", name: "Signed up", order: 1, step_type: "event", event_type: "signup", match_type: "exact" },
    ]);
    expect(proposal.summary.lines[0]).toBe("Step 1: Pricing (page is /pricing)");
    expect(proposal.summary.hasExternalEffect).toBe(false);
  });

  it("refuses one step, and too long a window", async () => {
    expect((await registry.run("propose_funnel", { name: "x", steps: [{ name: "a", type: "page", value: "/" }] }, ctx)).ok).toBe(false);
    const r = await registry.run("propose_funnel", {
      name: "x", steps: [{ name: "a", type: "page", value: "/" }, { name: "b", type: "page", value: "/b" }], conversionWindowHours: 5000,
    }, ctx);
    expect(r.ok).toBe(false);
  });

  it("keeps a contains match without forcing a slash", () => {
    const steps = buildSteps({ name: "x", steps: [{ name: "a", type: "page", value: "checkout", match: "contains" }, { name: "b", type: "event", value: "buy" }] });
    expect(steps[0]).toMatchObject({ page_path: "checkout", match_type: "contains" });
  });

  it("re-validates the stored payload when the draft is created", async () => {
    const created: unknown[] = [];
    const writer = new FunnelDraftService({ create: async (w, u, input) => { created.push(input); return { id: "f1" } as any; } }, async () => true);
    await expect(writer.createFromProposal({ websiteId: SITE, userId: USER, payload: { name: "x", steps: [] } })).rejects.toThrow("at least 2 steps");
    const ok = await writer.createFromProposal({
      websiteId: SITE, userId: USER,
      payload: { name: "x", steps: buildSteps({ name: "x", steps: [{ name: "a", type: "page", value: "/a" }, { name: "b", type: "page", value: "/b" }] }) },
    });
    expect(ok).toEqual({ id: "f1" });
    expect((created[0] as any).is_active).toBe(true);
  });
});

describe("propose_goal", () => {
  const registry = new ToolRegistry([proposeGoalTool(new GoalDraftService())]);

  it("drafts a page goal with a leading slash", async () => {
    const r = await registry.run("propose_goal", { name: "Thanks", type: "pageview", identifier: "thank-you" }, ctx);
    expect((r as any).data.proposal).toMatchObject({ resource: "goal", payload: { name: "Thanks", type: "pageview", identifier: "/thank-you" } });
  });

  it("refuses a goal type it cannot draft", async () => {
    expect((await registry.run("propose_goal", { name: "Click", type: "click", identifier: "#buy" }, ctx)).ok).toBe(false);
  });
});

const rec = (over: Partial<Recommendation> = {}): Recommendation => ({
  id: REC, websiteId: SITE, source: "heatmap", sourceRef: null, dedupeKey: "k", title: "Fix the fold on /pricing", rationale: "Most visitors never scroll.",
  prompt: "p", target: { kind: "page", ref: "/pricing", label: "/pricing" }, metric: { name: "bounce_rate", windowDays: 14 }, status: "measured",
  baseline: { value: 52, numerator: 1040, volume: 2000, from: "a", to: "b" }, appliedAt: "2026-09-01T00:00:00.000Z", appliedBy: USER,
  appliedVia: "proposal", resource: { resource: "automation", id: "a1" }, queryId: null,
  impact: {
    checkpoints: [{ day: 14, measuredAt: "", after: { value: 46, numerator: 460, volume: 1000, from: "", to: "" }, verdict: "improved", deltaPts: -6, z: -3.1, automation: null }],
    sentence: null, sentenceSource: null,
  },
  lastSeenAt: "", createdAt: "", updatedAt: "", ...over,
});
const row = (r: Recommendation): RecommendationSummaryRow => ({ ...r, report: buildReport(r, new Date("2026-10-14T00:00:00Z")) });

describe("recommendation tools", () => {
  const calls: unknown[] = [];
  const registry = new ToolRegistry(recommendationTools({
    list: async (websiteId, statuses) => { calls.push(["list", websiteId, statuses]); return [row(rec()), row(rec({ id: "x", status: "open", appliedAt: null, impact: null }))]; },
    get: async (websiteId, id) => { calls.push(["get", websiteId, id]); return id === REC ? row(rec()) : null; },
  }));

  it("lists with the impact line for applied ones, scoped to the request's site", async () => {
    const r = await registry.run("list_recommendations", { status: "measured" }, ctx);
    expect(calls.at(-1)).toEqual(["list", SITE, ["measured"]]);
    const [applied, open] = (r as any).data.recommendations;
    expect(applied.impact).toBe("Your change on /pricing: bounce rate −6 pts after 14 days (52% → 46%)");
    expect(open.impact).toBeUndefined();
  });

  it("returns the report with its verdict and caveats", async () => {
    const r = await registry.run("get_impact_report", { id: REC }, ctx);
    const data = (r as any).data;
    expect(data.verdict).toBe("improved");
    expect(data.readings[0]).toMatchObject({ days_after: 14, value_pct: 46, change_pts: -6 });
    expect(data.caveats.join(" ")).toContain("seasonality");
  });

  it("refuses an id that is not a uuid, and one from another site", async () => {
    expect((await registry.run("get_impact_report", { id: "1; drop" }, ctx)).ok).toBe(false);
    expect((await registry.run("get_impact_report", { id: "44444444-4444-4444-8444-444444444444" }, ctx)).ok).toBe(false);
  });
});
