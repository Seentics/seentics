import type { AnalyticsFunnelEvents } from "../../analytics/interfaces";
import type { Funnel, FunnelPerformance, FunnelReport } from "../interfaces";
import { findFunnel, listFunnels } from "../repositories/funnel.repository";
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
    const prepared = await this.prepare(funnel);
    const counts = prepared.reachable.length
      ? await this.analyticsEvents.countFunnelProgress(websiteId, prepared.reachable, startIso, endIso, funnel.conversion_window_hours) : [];
    return this.finish(prepared, counts);
  }

  async reports(websiteId: string, days?: number): Promise<Record<string, FunnelReport>> {
    const funnels = await listFunnels(websiteId);
    const prepared = await Promise.all(funnels.map(funnel => this.prepare(funnel)));
    const { startIso, endIso } = reportWindow(clampReportDays(days));
    const counts = await this.analyticsEvents.countFunnelsProgress(websiteId, prepared.filter(p => p.reachable.length).map(p => ({
      id: p.funnel.id, steps: p.reachable, windowHours: p.funnel.conversion_window_hours,
    })), startIso, endIso);
    return Object.fromEntries(prepared.map(p => [p.funnel.id, this.finish(p, counts[p.funnel.id] ?? [])]));
  }

  private readonly patterns = new Map<string, Promise<boolean>>();
  private validPattern(pattern: string): Promise<boolean> {
    const hit = this.patterns.get(pattern);
    if (hit) return hit;
    if (this.patterns.size >= 500) this.patterns.delete(this.patterns.keys().next().value!);
    const pending = this.analyticsEvents.isValidPattern(pattern).catch(error => { this.patterns.delete(pattern); throw error; });
    this.patterns.set(pattern, pending);
    return pending;
  }

  private async prepare(funnel: Funnel) {
    const definitions = funnel.steps.map(toProgressStep);
    const warnings: string[] = [];
    for (const [index, definition] of definitions.entries()) {
      if (definition?.kind !== "page" || definition.match !== "regex") continue;
      if (await this.validPattern(definition.path)) continue;
      definitions[index] = null;
      warnings.push(`${funnel.steps[index]?.name || `Step ${index + 1}`} uses a pattern that is not a valid regular expression, so nobody can reach it. Edit the step to fix it.`);
    }
    const unreachable = definitions.indexOf(null);
    if (unreachable !== -1 && !warnings.length) {
      warnings.push(`${funnel.steps[unreachable]?.name || `Step ${unreachable + 1}`} has nothing to match, so nobody can reach it.`);
    }
    const reachable = (unreachable === -1 ? definitions : definitions.slice(0, unreachable)) as FunnelProgressStep[];
    return { funnel, reachable, unreachable, warnings };
  }

  private finish(prepared: Awaited<ReturnType<FunnelPerformanceService['prepare']>>, counted: Array<{ step_order: number | null; cnt: number }>): FunnelReport {
    const { funnel, unreachable, warnings } = prepared;
    const report = buildFunnelReport(funnel.steps, unreachable === -1 ? counted : counted.filter(c => c.step_order !== -1));
    return warnings.length ? { ...report, warnings } : report;
  }
}
