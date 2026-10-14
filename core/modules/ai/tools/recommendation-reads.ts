import { z } from "zod";
import type { ImpactReport, RecommendationStatus } from "../recommendations/types";
import { RECOMMENDATION_STATUSES } from "../recommendations/types";
import type { AiTool, ToolResult } from "./tool.types";

/**
 * `list_recommendations` and `get_impact_report`: what the product has suggested for this website,
 * what was done about it, and what changed afterwards.
 *
 * Read tools over the recommendations service (injected as two functions, so this file does not
 * hold the service). The website comes from `ToolContext`, never the model. The report is the
 * code-built one, with its verdict and caveats, so the assistant relays a judgement already made
 * rather than drawing its own conclusion from two numbers.
 */

/** The narrow view of a stored recommendation these tools need. */
export type RecommendationSummaryRow = {
  id: string;
  source: string;
  title: string;
  rationale: string;
  status: RecommendationStatus;
  target: { kind: string; ref: string | null; label: string };
  appliedAt: string | null;
  resource: { resource: string; id: string } | null;
  report: ImpactReport;
};

export type RecommendationReadPorts = {
  list(websiteId: string, statuses?: RecommendationStatus[]): Promise<RecommendationSummaryRow[]>;
  get(websiteId: string, id: string): Promise<RecommendationSummaryRow | null>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Compact, model-facing. Exported for tests. */
export function compactRecommendation(r: RecommendationSummaryRow) {
  return {
    id: r.id,
    title: r.title,
    why: r.rationale,
    source: r.source,
    status: r.status,
    target: r.target.ref ?? r.target.label,
    ...(r.appliedAt ? { applied_at: r.appliedAt.slice(0, 10) } : {}),
    ...(r.resource ? { created: `${r.resource.resource} ${r.resource.id}` } : {}),
    ...(r.report.status !== "not_applied" ? { impact: r.report.headline, impact_status: r.report.status } : {}),
  };
}

/** The full report, shaped for the model. Exported for tests. */
export function compactReport(r: RecommendationSummaryRow) {
  const rep = r.report;
  return {
    id: r.id,
    title: r.title,
    status: rep.status,
    metric: rep.metric.name,
    target: r.target.ref ?? r.target.label,
    applied_at: rep.appliedAt,
    baseline: rep.baseline ? { value_pct: rep.baseline.value, volume: rep.baseline.volume, from: rep.baseline.from, to: rep.baseline.to } : null,
    readings: rep.checkpoints.map((c) => ({
      days_after: c.day,
      value_pct: c.after?.value ?? null,
      volume: c.after?.volume ?? null,
      change_pts: c.deltaPts,
      verdict: c.verdict,
      ...(c.automation ? { automation_runs: c.automation.totalExecutions, automation_successful_actions: c.automation.successCount } : {}),
    })),
    verdict: rep.verdict,
    headline: rep.headline,
    summary: rep.sentence,
    caveats: rep.caveats,
    ...(rep.nextCheckAt ? { next_reading_at: rep.nextCheckAt } : {}),
  };
}

export function recommendationTools(ports: RecommendationReadPorts): AiTool<any>[] {
  const listTool: AiTool<{ status?: RecommendationStatus }> = {
    name: "list_recommendations",
    kind: "read",
    description:
      "Suggestions Seentics has made for this website (from daily insights, heatmaps and frustrated " +
      "sessions), and changes made through the assistant, with their status: open, dismissed, applied, " +
      "measuring (impact being measured) or measured. Applied ones carry a one-line impact result. " +
      "Use for 'what should I do next', 'what did my changes do', or before suggesting something already suggested.",
    schema: z.object({
      status: z.enum(RECOMMENDATION_STATUSES).optional().describe("Only this status; omit for all"),
    }) as unknown as z.ZodType<{ status?: RecommendationStatus }>,
    async handler(args, ctx): Promise<ToolResult> {
      try {
        const rows = await ports.list(ctx.websiteId, args.status ? [args.status] : undefined);
        return { ok: true, data: { recommendations: rows.slice(0, 25).map(compactRecommendation) } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "Read failed" };
      }
    },
  };

  const reportTool: AiTool<{ id: string }> = {
    name: "get_impact_report",
    kind: "read",
    description:
      "The before-and-after impact report for one applied recommendation: the target metric over the " +
      "14 days before the change, readings 7 and 14 days after, the verdict (improved, worse, no_change, " +
      "too_little_data, no_baseline, not_measurable) and caveats. Relay the verdict and caveats as given; " +
      "never claim the change caused the result. Call list_recommendations first to find the id.",
    schema: z.object({
      id: z.string().trim().min(1).max(64).describe("Recommendation id from list_recommendations"),
    }) as unknown as z.ZodType<{ id: string }>,
    async handler(args, ctx): Promise<ToolResult> {
      // Model-supplied: checked before it reaches a uuid column.
      if (!UUID.test(args.id)) return { ok: false, error: "Not a recommendation id. Call list_recommendations to find it." };
      try {
        const row = await ports.get(ctx.websiteId, args.id);
        if (!row) return { ok: false, error: "No recommendation with that id on this website. Call list_recommendations." };
        return { ok: true, data: compactReport(row) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "Read failed" };
      }
    },
  };

  return [listTool, reportTool];
}
