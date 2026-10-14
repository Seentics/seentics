import { z } from "zod";
import type { HeatmapClickTarget, HeatmapDeviceAnalysis, HeatmapPageAnalysis, HeatmapPageAnalysisReads } from "../../heatmaps/interfaces";
import { asMetrics, type DisplayBlock } from "./display";
import type { AiTool, ToolResult } from "./tool.types";

/**
 * `get_heatmap_insights`: what one page's clicks and scroll depths say, from the heatmaps
 * module's own analysis (injected — this module never reads heatmap internals).
 *
 * Shaped for the model: percentages and counts it can quote, the elements by selector, the
 * rule-stated findings, and what is not measured, so it does not promise rage clicks or
 * attention data that do not exist. Every token here is replayed on later turns, so lists are
 * short and nothing is nested deeper than it has to be.
 */

const element = (t: HeatmapClickTarget) => ({
  element: t.selector,
  ...(t.tag ? { tag: t.tag } : {}),
  share_pct: t.share,
  depth_pct: t.depth_pct,
  ...(t.pinned ? { always_visible: true } : t.reach_pct !== null ? { reached_by_pct: t.reach_pct } : {}),
});

function deviceSummary(a: HeatmapDeviceAnalysis) {
  return {
    device: a.device,
    ...(a.scroll ? { page_views: a.scroll.page_views, median_scroll_stop_pct: a.scroll.median_depth, fold_pct: a.scroll.fold_pct } : {}),
    ...(a.clicks ? {
      clicks: a.clicks.clicks,
      clicks_per_view: a.clicks.clicks_per_view,
      ...(a.clicks.dead_clicks.known_share >= 50 ? { dead_click_share_pct: a.clicks.dead_clicks.share } : {}),
    } : {}),
  };
}

/** The compact, model-facing form of an analysis. Exported for tests. */
export function compactHeatmapInsights(a: HeatmapPageAnalysis) {
  if (!a.sufficient) return { page: a.page_path, days: a.days, sufficient: false, reason: a.reason };
  const s = a.overall.scroll;
  const c = a.overall.clicks;
  return {
    page: a.page_path,
    days: a.days,
    ...(s ? {
      scroll: {
        page_views: s.page_views,
        median_stop_pct: s.median_depth,
        fold_pct: s.fold_pct,
        reach_pct: { "25": s.reach.p25, "50": s.reach.p50, "75": s.reach.p75, "100": s.reach.p100 },
        ...(s.stayed_above_fold_pct !== null ? { never_scrolled_past_fold_pct: s.stayed_above_fold_pct } : {}),
      },
    } : {}),
    ...(c ? {
      clicks: {
        total: c.clicks,
        per_view: c.clicks_per_view,
        top3_share_pct: c.top3_share,
        above_fold_share_pct: c.above_fold_share,
        top_elements: c.top.slice(0, 5).map(element),
        ...(c.dead_clicks.known_share >= 50
          ? { dead_click_candidates: { share_pct: c.dead_clicks.share, top: c.dead_clicks.targets.slice(0, 3).map((t) => ({ element: t.selector, clicks: t.clicks })) } }
          : {}),
        ...(c.ctas.length ? { links_and_buttons: c.ctas.slice(0, 3).map(element) } : {}),
      },
    } : {}),
    ...(a.devices.length > 1 ? { devices: a.devices.map(deviceSummary) } : {}),
    findings: a.signals.slice(0, 5).map((sig) => ({ finding: sig.finding, fix: sig.fix })),
    not_measured: "rage clicks, time per section, unique visitors (figures are page views), what happened after a click",
  };
}

function metricsOf(a: HeatmapPageAnalysis): DisplayBlock | undefined {
  if (!a.sufficient) return undefined;
  const s = a.overall.scroll;
  const c = a.overall.clicks;
  const items: Extract<DisplayBlock, { kind: "metrics" }>["items"] = [];
  if (s) {
    items.push({ label: "Page views", value: s.page_views, format: "number" });
    items.push({ label: "Median scroll stop", value: `${s.median_depth}%` });
    if (s.fold_pct !== null) items.push({ label: "Fold", value: `${s.fold_pct}% of page` });
  }
  if (c) {
    items.push({ label: "Clicks", value: c.clicks, format: "number" });
    if (c.dead_clicks.known_share >= 50) items.push({ label: "Dead-click candidates", value: `${c.dead_clicks.share}%` });
  }
  return items.length ? asMetrics(items) : undefined;
}

export function heatmapInsightsTool(analysis: HeatmapPageAnalysisReads): AiTool<{ pagePath: string; days: number }> {
  return {
    name: "get_heatmap_insights",
    kind: "read",
    description:
      "What one page's heatmap shows: how far page views scroll (median stop, the fold, % reaching " +
      "25/50/75/100%), which elements get the clicks, dead-click candidates (clicks on things that are " +
      "not links or buttons), whether the main links and buttons sit where most page views reach, and " +
      "mobile vs desktop differences, with suggested fixes. Rage clicks and time per section are not " +
      "measured. Call list_heatmap_pages first if you do not know the page's path.",
    schema: z.object({
      pagePath: z.string().trim().min(1).max(2048).describe("Page path as list_heatmap_pages shows it, e.g. /pricing"),
      days: z.number().int().min(1).max(366).default(30).describe("Look-back window in days (1-366)"),
    }) as unknown as z.ZodType<{ pagePath: string; days: number }>,
    handler: async (args, ctx): Promise<ToolResult> => {
      try {
        const a = await analysis.analyzePage(ctx.websiteId, args.pagePath, { days: args.days });
        return { ok: true, data: { data: compactHeatmapInsights(a), display: metricsOf(a) } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "Read failed" };
      }
    },
  };
}
