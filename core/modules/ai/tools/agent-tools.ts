import type { AnalyticsReads } from "../../analytics/interfaces";
import type { AutomationDraftValidator, AutomationDraftWriter } from "../../automations/interfaces/automations.module";
import type { ErrorQueries } from "../../errors/interfaces";
import type { FunnelDraftPort, FunnelPerformance } from "../../funnels/interfaces";
import type { HeatmapPageAnalysisReads } from "../../heatmaps/interfaces";
import type { SessionAnalysisReads } from "../../recordings/interfaces";
import type { GoalDraftPort, SiteSettingsDraftPort } from "../../websites/interfaces";
import { funnelReads } from "./funnel-reads";
import { heatmapInsightsTool } from "./heatmap-reads";
import { automationEditTools } from "./propose-automation-edit.tool";
import { proposeAutomationTool } from "./propose-automation.tool";
import { funnelEditTools } from "./propose-funnel-edit.tool";
import { proposeFunnelTool } from "./propose-funnel.tool";
import { goalEditTools, proposeGoalTool } from "./propose-goal.tool";
import { siteSettingsTools } from "./propose-site-settings.tool";
import { alertTools, errorTriageTool, recommendationTriageTool, type AlertPorts } from "./propose-triage.tool";
import { readTools, type ReadPorts } from "./read-tools";
import { recommendationTools, type RecommendationReadPorts } from "./recommendation-reads";
import { ToolRegistry } from "./registry";
import { sessionTools } from "./session-reads";

/**
 * Everything the assistant's tools read from or validate against, as ports.
 *
 * The registry is assembled here rather than inline in `init.ts` so the one composition is
 * shared by production and by the evaluation harness (`evals/`), which runs the real tools over
 * in-memory fixtures: what is measured there is the tool list, order and wording users get.
 */
export type AgentToolDeps = {
  analytics: Pick<AnalyticsReads, "getDashboard" | "getPages" | "getSources" | "getDimensionsBulk" | "getRevenueDashboard">;
  errorQueries: Pick<ErrorQueries, "listGroups" | "getGroup">;
  /** The fixed SQL reads (`sqlBackedReads`): funnel definitions, automations, heatmap pages, sessions. */
  fixed: {
    funnels: (websiteId: string) => Promise<Record<string, unknown>[]>;
    automations: (websiteId: string) => Promise<unknown>;
    heatmapPages: (websiteId: string, days: number) => Promise<unknown>;
    recentSessions: (websiteId: string, limit: number) => Promise<unknown>;
  };
  funnelPerformance: FunnelPerformance;
  heatmapAnalysis: HeatmapPageAnalysisReads;
  sessionAnalysis: SessionAnalysisReads;
  automationDrafts: AutomationDraftValidator;
  automationProposals: Pick<AutomationDraftWriter, "get">;
  funnelDrafts?: FunnelDraftPort;
  goalDrafts: GoalDraftPort;
  siteSettingsDrafts: SiteSettingsDraftPort;
  /** Absent without anomaly detection. */
  alerts?: AlertPorts;
  /** Absent without the recommendations loop. */
  recommendations?: RecommendationReadPorts;
};

/** The read ports `readTools` takes, from the module ports. */
export function agentReadPorts(deps: Pick<AgentToolDeps, "analytics" | "errorQueries" | "fixed" | "funnelPerformance">): ReadPorts {
  const q = (days: number) => ({ days: String(days) }) as never;
  const funnels = funnelReads({ definitions: deps.fixed.funnels, performance: deps.funnelPerformance });
  return {
    trafficSummary: (id, days) => deps.analytics.getDashboard(id, q(days)),
    topPages: (id, days) => deps.analytics.getPages(id, q(days)),
    topSources: (id, days) => deps.analytics.getSources(id, q(days)),
    dimensions: (id, days) => deps.analytics.getDimensionsBulk(id, q(days)),
    revenue: (id, days) => deps.analytics.getRevenueDashboard(id, q(days)),
    // `fingerprint` is dropped on the way to the model (it reads as a device fingerprint there); an
    // error group's is a hash of its message and source, and the model needs it to draft a status change.
    errorGroups: async (id, days) => {
      const r = await deps.errorQueries.listGroups(id, { days });
      return { groups: r.groups.map((g) => ({ ...g, error_fingerprint: g.fingerprint })) };
    },
    funnels: funnels.funnels,
    funnelPerformance: funnels.funnelPerformance,
    automations: deps.fixed.automations,
    heatmapPages: deps.fixed.heatmapPages,
    recentSessions: deps.fixed.recentSessions,
  };
}

/**
 * The agent's entire vocabulary: it can answer from these reads and draft from these proposals,
 * and there is nothing else it could call.
 */
export function buildAgentRegistry(deps: AgentToolDeps): ToolRegistry {
  return new ToolRegistry([
    ...readTools(agentReadPorts(deps)),
    heatmapInsightsTool(deps.heatmapAnalysis),
    ...sessionTools(deps.sessionAnalysis),
    proposeAutomationTool(deps.automationDrafts, deps.automationDrafts.vocabulary()),
    ...automationEditTools({ automations: deps.automationProposals, validator: deps.automationDrafts }),
    ...(deps.funnelDrafts ? [proposeFunnelTool(deps.funnelDrafts), ...funnelEditTools(deps.funnelDrafts)] : []),
    proposeGoalTool(deps.goalDrafts),
    ...goalEditTools(deps.goalDrafts),
    ...siteSettingsTools(deps.siteSettingsDrafts),
    errorTriageTool(deps.errorQueries),
    ...(deps.alerts ? alertTools(deps.alerts) : []),
    ...(deps.recommendations ? [recommendationTriageTool({ get: deps.recommendations.get })] : []),
    ...(deps.recommendations ? recommendationTools(deps.recommendations) : []),
  ]);
}
