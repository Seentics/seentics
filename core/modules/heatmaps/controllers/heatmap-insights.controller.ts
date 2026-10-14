import type { Context } from "hono";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { log } from "../../../platform/observability/logger";
import { parseQuery } from "../../../platform/validation";
import { roleAtLeast } from "../../websites/interfaces";
import type { HeatmapInsightNarration, HeatmapPageAnalysis } from "../interfaces";
import { ruleFindings } from "../lib/heatmap-insights";
import { heatmapInsightsQuerySchema } from "../validators/heatmap.schema";
import { requireHeatmapAccess } from "./heatmap-access";
import type { HeatmapControllerDeps } from "./heatmap-controller.types";

/**
 * One page's insights: the analysis, and its findings in plain English.
 *
 * The analysis is always computed here, from this module's data. The wording comes from the
 * narrator when a model is configured — stored, so a page view of the heatmap does not cost a
 * model call each time — and otherwise from the rules that found the signals. A narrator that
 * fails never fails the request: the numbers are still worth showing.
 */

type Present = {
  analysis: HeatmapPageAnalysis;
  insights: HeatmapInsightNarration;
  ai_configured: boolean;
};

function fromRules(analysis: HeatmapPageAnalysis, reason: string | null): HeatmapInsightNarration {
  return {
    source: "rules",
    findings: analysis.sufficient ? ruleFindings(analysis.signals) : [],
    generated_at: new Date().toISOString(),
    reason: analysis.sufficient ? reason : analysis.reason,
    retry_after_sec: null,
  };
}

async function build(
  deps: Required<Pick<HeatmapControllerDeps, "insights">>["insights"],
  websiteId: string,
  query: { page_path: string; days: number; device: "all" | "desktop" | "tablet" | "mobile" },
  refresh: boolean,
): Promise<Present> {
  const analysis = await deps.analysis.analyzePage(websiteId, query.page_path, { days: query.days, device: query.device });
  const narrator = deps.narrator();
  const configured = !!narrator?.configured;
  if (!narrator || !configured || !analysis.sufficient || !analysis.signals.length) {
    return { analysis, insights: fromRules(analysis, null), ai_configured: configured };
  }
  try {
    return { analysis, insights: await narrator.narrate(websiteId, analysis, { refresh }), ai_configured: true };
  } catch (err) {
    log.warn({ msg: "heatmap_insights_narration_failed", website_uuid: websiteId, err: String(err) });
    return {
      analysis,
      insights: fromRules(analysis, "The AI wording could not be produced right now; these findings are written from the data alone."),
      ai_configured: true,
    };
  }
}

/** GET /:website_id/insights?page_path=&days=&device= — any role that can read the heatmap. */
export function getHeatmapInsights(deps: HeatmapControllerDeps) {
  return async (c: Context<{ Variables: AuthVars }, "/:website_id/insights">) => {
    const websiteRef = c.req.param("website_id");
    const denied = await requireHeatmapAccess(c, deps, websiteRef);
    if (denied) return denied;
    if (!deps.insights) return c.json({ error: "Heatmap insights are not available." }, 503);
    const query = parseQuery(c, heatmapInsightsQuerySchema);
    if (!query.ok) return query.res;
    return c.json({ data: await build(deps.insights, websiteRef, query.data, false) });
  };
}

/**
 * POST /:website_id/insights/refresh?page_path=&days=&device= — word the page again now.
 *
 * Members and up, as with the daily insight's refresh: each one can cost a model call. The
 * narrator enforces the cooldown and says how long is left in `retry_after_sec`.
 */
export function refreshHeatmapInsights(deps: HeatmapControllerDeps) {
  return async (c: Context<{ Variables: AuthVars }, "/:website_id/insights/refresh">) => {
    const websiteRef = c.req.param("website_id");
    const denied = await requireHeatmapAccess(c, deps, websiteRef);
    if (denied) return denied;
    const role = await deps.websites.getRole(websiteRef, requireUser(c) ?? "");
    if (!role || !roleAtLeast(role, "member")) return c.json({ error: "forbidden" }, 403);
    if (!deps.insights) return c.json({ error: "Heatmap insights are not available." }, 503);
    const query = parseQuery(c, heatmapInsightsQuerySchema);
    if (!query.ok) return query.res;
    const body = await build(deps.insights, websiteRef, query.data, true);
    if (body.insights.retry_after_sec) c.header("Retry-After", String(body.insights.retry_after_sec));
    return c.json({ data: body });
  };
}
