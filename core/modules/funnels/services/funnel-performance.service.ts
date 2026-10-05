import type { AnalyticsFunnelEvents } from "../../analytics/interfaces";
import type { FunnelPerformance, FunnelReport } from "../interfaces";
import { findFunnel } from "../repositories/funnel.repository";
import type { FunnelProgressStep } from "../../analytics/interfaces";
import { toProgressStep } from "../lib/funnel-step-definition";
import {
  buildFunnelReport,
  clampReportDays,
  reportWindow,
} from "./funnel-report-calculation.service";

/** Computes conversion performance from a definition and analytics-owned events. */
export class FunnelPerformanceService implements FunnelPerformance {
  constructor(private readonly analyticsEvents: AnalyticsFunnelEvents) {}

  async report(
    websiteId: string,
    funnelId: string,
    days?: number,
  ): Promise<FunnelReport | null> {
    const funnel = await findFunnel(websiteId, funnelId);
    if (!funnel) return null;
    const { startIso, endIso } = reportWindow(clampReportDays(days));
    // Counted from the page views and events themselves, not from progress the tracker
    // reported: a visitor who has not consented keeps no progress in their browser, and was
    // counted at the first step and lost after it.
    const definitions = funnel.steps.map(toProgressStep);
    const warnings: string[] = [];

    // A regular expression the database cannot run (a funnel saved before saves were checked)
    // leaves its step unreachable, and the report says which, rather than failing outright.
    for (const [index, definition] of definitions.entries()) {
      if (definition?.kind !== "page" || definition.match !== "regex") continue;
      if (await this.analyticsEvents.isValidPattern(definition.path)) continue;
      definitions[index] = null;
      warnings.push(`${funnel.steps[index]?.name || `Step ${index + 1}`} uses a pattern that is not a valid regular expression, so nobody can reach it. Edit the step to fix it.`);
    }
    const unreachable = definitions.indexOf(null);
    if (unreachable !== -1 && !warnings.length) {
      warnings.push(`${funnel.steps[unreachable]?.name || `Step ${unreachable + 1}`} has nothing to match, so nobody can reach it.`);
    }
    const reachable = (unreachable === -1 ? definitions : definitions.slice(0, unreachable)) as FunnelProgressStep[];
    const counted = reachable.length
      ? await this.analyticsEvents.countFunnelProgress(websiteId, reachable, startIso, endIso, funnel.conversion_window_hours)
      : [];
    // A step with nothing to match can never be reached, so nobody completes the funnel.
    const counts = unreachable === -1 ? counted : counted.filter((c) => c.step_order !== -1);
    const report = buildFunnelReport(funnel.steps, counts);
    return warnings.length ? { ...report, warnings } : report;
  }
}
