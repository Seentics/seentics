import { describe, expect, it } from "bun:test";
import { analysePage, type ClickRow, type ScrollRow } from "../../heatmaps/lib/heatmap-insights";
import type { HeatmapInsightDevice, HeatmapPageAnalysis, HeatmapPageAnalysisReads } from "../../heatmaps/interfaces";
import { compactHeatmapInsights, heatmapInsightsTool } from "../tools/heatmap-reads";
import { readTools, type ReadPorts } from "../tools/read-tools";
import { ToolRegistry } from "../tools/registry";

/**
 * `get_heatmap_insights` over a stubbed analysis port, and `list_heatmap_pages`' window.
 * The website comes from the context, never the arguments.
 */

const s = (device: string, depth: number, views: number, fold: number): ScrollRow => ({ device, depth, views, fold, viewportPx: 900, documentPx: 3600 });
const c = (device: string, selector: string, tag: string, y: number, clicks: number): ClickRow => ({
  device, selector, band: Math.min(9, Math.floor(y / 1000)), clicks, yWeighted: y * clicks, tag, role: null, annotated: false, pinned: false,
});

function analysis(path: string, days: number, device: HeatmapInsightDevice = "all"): HeatmapPageAnalysis {
  return analysePage({
    pagePath: path, days, device,
    scrollRows: [s("desktop", 25, 40, 25), s("desktop", 50, 30, 25), s("desktop", 100, 30, 25), s("mobile", 15, 70, 15), s("mobile", 100, 30, 15)],
    clickRows: [c("desktop", "a#signup", "a", 7500, 40), c("desktop", "div.hero", "div", 1500, 25), c("mobile", "a#signup", "a", 9000, 30)],
  });
}

class FakeAnalysis implements HeatmapPageAnalysisReads {
  calls: Array<{ websiteId: string; pagePath: string; days?: number }> = [];
  async analyzePage(websiteId: string, pagePath: string, opts?: { days?: number }) {
    this.calls.push({ websiteId, pagePath, days: opts?.days });
    return analysis(pagePath, opts?.days ?? 30);
  }
}

const ctx = { websiteId: "site-ctx", userId: "u1" };

describe("get_heatmap_insights", () => {
  it("reads the page for the context's website with a 30-day default", async () => {
    const fake = new FakeAnalysis();
    const registry = new ToolRegistry([heatmapInsightsTool(fake)]);
    const res = await registry.run("get_heatmap_insights", { pagePath: "/pricing", websiteId: "someone-else" }, ctx);
    expect(res.ok).toBe(true);
    expect(fake.calls).toEqual([{ websiteId: "site-ctx", pagePath: "/pricing", days: 30 }]);
  });

  it("returns compact figures, findings and what is not measured, with a metrics block", async () => {
    const registry = new ToolRegistry([heatmapInsightsTool(new FakeAnalysis())]);
    const res = await registry.run("get_heatmap_insights", { pagePath: "/pricing", days: 7 }, ctx);
    if (!res.ok) throw new Error(res.error);
    const { data, display } = res.data as { data: Record<string, any>; display: any };
    expect(data.page).toBe("/pricing");
    expect(data.days).toBe(7);
    expect(data.scroll).toMatchObject({ page_views: 200, median_stop_pct: 25, fold_pct: 15 });
    expect(data.clicks.top_elements[0]).toMatchObject({ element: "a#signup", tag: "a" });
    expect(data.clicks.dead_click_candidates.top[0]).toEqual({ element: "div.hero", clicks: 25 });
    expect(data.devices.map((d: { device: string }) => d.device)).toEqual(["desktop", "mobile"]);
    expect(data.findings.length).toBeGreaterThan(0);
    expect(data.not_measured).toContain("rage clicks");
    expect(display.kind).toBe("metrics");
    expect(display.items.map((i: { label: string }) => i.label)).toContain("Median scroll stop");
    // Small enough to replay on every later turn.
    expect(JSON.stringify(data).length).toBeLessThan(4000);
  });

  it("says why when a page has too little data", () => {
    const quiet = analysePage({ pagePath: "/q", days: 30, device: "all", scrollRows: [], clickRows: [] });
    expect(compactHeatmapInsights(quiet)).toEqual({ page: "/q", days: 30, sufficient: false, reason: quiet.reason });
  });

  it("turns a failed read into a message", async () => {
    const registry = new ToolRegistry([heatmapInsightsTool({ analyzePage: async () => { throw new Error("db down"); } })]);
    expect(await registry.run("get_heatmap_insights", { pagePath: "/p" }, ctx)).toEqual({ ok: false, error: "db down" });
  });

  it("requires a page path and offers days as optional", () => {
    const schema = new ToolRegistry([heatmapInsightsTool(new FakeAnalysis())]).schemas()[0]!;
    expect(schema.parameters).toMatchObject({ required: ["pagePath"] });
  });
});

describe("list_heatmap_pages", () => {
  it("reads over 30 days unless asked otherwise", async () => {
    const calls: Array<[string, number]> = [];
    const unused = async () => [];
    const ports = {
      trafficSummary: unused, topPages: unused, topSources: unused, dimensions: unused, funnels: unused,
      funnelPerformance: unused, automations: unused, recentSessions: unused, errorGroups: unused, revenue: unused,
      heatmapPages: async (id: string, days: number) => { calls.push([id, days]); return [{ page_path: "/", clicks: 3, page_views: 10, median_scroll_stop_pct: 40 }]; },
    } as unknown as ReadPorts;
    const registry = new ToolRegistry(readTools(ports));
    await registry.run("list_heatmap_pages", {}, ctx);
    await registry.run("list_heatmap_pages", { days: 7 }, ctx);
    expect(calls).toEqual([["site-ctx", 30], ["site-ctx", 7]]);
  });
});
