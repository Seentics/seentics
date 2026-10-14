import { describe, expect, it } from "bun:test";
import type { FunnelPerformance, FunnelReport } from "../../funnels/interfaces";
import { funnelReads } from "../tools/funnel-reads";
import { readTools, type ReadPorts } from "../tools/read-tools";

const SITE = "11111111-1111-4111-8111-111111111111";
const FUNNEL = "22222222-2222-4222-8222-222222222222";

const REPORT: FunnelReport = {
  totalEntries: 200,
  completions: 30,
  conversionRate: 15,
  stepBreakdown: [
    { stepOrder: 0, stepName: "Landing", count: 200, dropoffCount: 0, dropoffRate: 0 },
    { stepOrder: 1, stepName: "Pricing", count: 80, dropoffCount: 120, dropoffRate: 60 },
    { stepOrder: 2, stepName: "Signup", count: 30, dropoffCount: 50, dropoffRate: 62.5 },
  ],
};

const definitions = async () => [
  { id: FUNNEL, name: "Signup flow", is_active: true, steps: [{ name: "Landing" }, { name: "Pricing" }, { name: "Signup" }], description: "x" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Checkout", is_active: false, steps: [{}, { name: " Pay " }] },
];

function performance(calls: unknown[] = []): FunnelPerformance {
  return {
    report: async (site, id, days) => { calls.push(["report", site, id, days]); return id === FUNNEL ? REPORT : null; },
    reports: async (site, days) => { calls.push(["reports", site, days]); return { [FUNNEL]: REPORT }; },
    reportBetween: async (site, id) => { calls.push(["reportBetween", site, id]); return id === FUNNEL ? REPORT : null; },
  };
}

describe("funnel reads", () => {
  it("returns the real report for the requested days, compacted", async () => {
    const calls: unknown[] = [];
    const reads = funnelReads({ definitions, performance: performance(calls) });
    expect(await reads.funnelPerformance(SITE, FUNNEL, 30)).toEqual({
      name: "Signup flow",
      days: 30,
      entries: 200,
      completions: 30,
      conversion_rate: 15,
      steps: [
        { name: "Landing", count: 200, dropoff: 0, dropoff_rate: 0 },
        { name: "Pricing", count: 80, dropoff: 120, dropoff_rate: 60 },
        { name: "Signup", count: 30, dropoff: 50, dropoff_rate: 62.5 },
      ],
    });
    expect(calls).toEqual([["report", SITE, FUNNEL, 30]]);
  });

  it("refuses a malformed id before it reaches the database, and an unknown one after", async () => {
    const calls: unknown[] = [];
    const reads = funnelReads({ definitions, performance: performance(calls) });
    await expect(reads.funnelPerformance(SITE, "Signup flow", 7)).rejects.toThrow("list_funnels");
    expect(calls).toEqual([]);
    await expect(reads.funnelPerformance(SITE, "44444444-4444-4444-8444-444444444444", 7)).rejects.toThrow("No funnel");
  });

  it("lists funnels with step names and headline conversion from one reports call", async () => {
    const calls: unknown[] = [];
    const rows = await funnelReads({ definitions, performance: performance(calls) }).funnels(SITE, 14);
    expect(rows).toEqual([
      { id: FUNNEL, name: "Signup flow", active: true, steps: "Landing → Pricing → Signup", entries: 200, completions: 30, conversion_rate: 15 },
      { id: "33333333-3333-4333-8333-333333333333", name: "Checkout", active: false, steps: "Step 1 → Pay" },
    ]);
    expect(calls).toEqual([["reports", SITE, 14]]);
  });

  it("still lists funnels when the figures cannot be read", async () => {
    const perf = { ...performance(), reports: async () => { throw new Error("timeout"); } };
    const rows = await funnelReads({ definitions, performance: perf }).funnels(SITE, 7);
    expect(rows.map((r) => r.name)).toEqual(["Signup flow", "Checkout"]);
    expect(rows[0]).not.toHaveProperty("conversion_rate");
  });
});

describe("get_funnel_performance tool", () => {
  const reads = funnelReads({ definitions, performance: performance() });
  const unused = async () => [];
  const ports: ReadPorts = {
    trafficSummary: unused, topPages: unused, topSources: unused, dimensions: unused, automations: unused,
    heatmapPages: unused, recentSessions: unused, errorGroups: unused, revenue: unused,
    funnels: reads.funnels, funnelPerformance: reads.funnelPerformance,
  };
  const tool = readTools(ports).find((t) => t.name === "get_funnel_performance")!;
  const ctx = { websiteId: SITE, userId: "u1" };

  it("passes days through and draws a funnel block", async () => {
    const result = await tool.handler(tool.schema.parse({ funnelId: FUNNEL, days: 30 }), ctx);
    expect(result.ok).toBe(true);
    const payload = (result as { data: { data: { days: number }; display: unknown } }).data;
    expect(payload.data.days).toBe(30);
    expect(payload.display).toEqual({
      kind: "funnel",
      steps: [
        { label: "Landing", value: 200, conversionRate: 1 },
        { label: "Pricing", value: 80, conversionRate: 0.4 },
        { label: "Signup", value: 30, conversionRate: 0.15 },
      ],
    });
  });

  it("turns a missing funnel into a message for the model", async () => {
    const result = await tool.handler(tool.schema.parse({ funnelId: "nope" }), ctx);
    expect(result).toEqual({ ok: false, error: "Not a funnel id. Call list_funnels to find it." });
  });
});
