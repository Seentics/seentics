import type { AnalyticsAnomalyReads, AnalyticsImpactReads, AnalyticsInsightReads, AnalyticsReads } from "../analytics/interfaces";
import type { AutomationInsights } from "../automations/interfaces";
import type { RetentionSiteSource } from "../../platform/retention";
import type { AutomationDraftValidator } from "../automations/interfaces/automations.module";
import type { ErrorAnomalyReads, ErrorQueries } from "../errors/interfaces";
import type { FunnelDraftPort, FunnelPerformance } from "../funnels/interfaces";
import type { HeatmapPageAnalysisReads } from "../heatmaps/interfaces";
import type { SessionAnalysisReads } from "../recordings/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { AiModule } from "./interfaces";
import type { LlmClient } from "./interfaces/llm-client.interface";
import { AiUsageCounter } from "./services/usage-count.service";
import { AiRetentionPurge } from "./services/retention-purge.service";
import { createAiRoutes } from "./routes";
import { AgentService } from "./services/agent/agent.service";
import { ProposalApplier, type ProposalWriters } from "./services/agent/proposal-applier";
import { ToolRegistry } from "./tools/registry";
import { readTools, type ReadPorts } from "./tools/read-tools";
import { sqlBackedReads } from "./tools/sql-backed-reads";
import { funnelReads } from "./tools/funnel-reads";
import { proposeAutomationTool } from "./tools/propose-automation.tool";
import { proposeFunnelTool } from "./tools/propose-funnel.tool";
import { proposeGoalTool } from "./tools/propose-goal.tool";
import { recommendationTools } from "./tools/recommendation-reads";
import { composeRecommendations } from "./recommendations/compose";
import { heatmapInsightsTool } from "./tools/heatmap-reads";
import { sessionTools } from "./tools/session-reads";
import { SessionSummaryService } from "./sessions/summarizer";
import { HeatmapInsightService } from "./heatmap-insights/service";
import { PostgresHeatmapInsightRepository } from "./heatmap-insights/postgres-repository";
import { NaturalLanguageQueryService } from "./services/natural-language-query.service";
import { BACKGROUND_MODEL, createLlmClient, readAiProviderConfig, resolveAiProvider } from "./services/llm";
import { PostgresAiRepository } from "./repositories/postgres-ai.repository";
import { INSIGHT_DAYS, InsightService } from "./insights/service";
import { PostgresInsightRepository } from "./insights/postgres-repository";
import { readInsightSnapshot } from "./insights/snapshot";
import { gatewayNotifySender, runWeeklyDigest } from "./digest/runner";
import { DIGEST_DAYS } from "./digest/builder";
import { log as baseLog } from "../../platform/observability/logger";
import { alertOps } from "../../platform/observability/ops-alert";
import { AnomalyService, gatewayAlertSender } from "./anomalies/service";
import { PostgresAnomalyRepository } from "./anomalies/postgres-repository";
import { AnomalyExplainer } from "./anomalies/explain";

const log = baseLog.child({ category: "ai_insights" });

/**
 * Build the AI module.
 *
 * Purely a consumer: it reads through other modules' query surfaces and offers no
 * capability anything else needs, which is why `AiModule` is just its routes.
 */
export function initAiModule(deps: {
  websitesModule: WebsitesModule;
  /** Typed analytics reads. Everything else the agent needs has no port yet. */
  analyticsReads: AnalyticsReads;
  errorQueries: ErrorQueries;
  /** Validates a draft against the same schema the create endpoint uses. */
  automationDrafts: AutomationDraftValidator;
  /** The entire write surface an approved proposal can reach. */
  writers: ProposalWriters;
  /** The aggregates behind the daily dashboard insight. */
  analyticsInsights: AnalyticsInsightReads;
  /** Every website, for the daily insight job. */
  sites: RetentionSiteSource;
  /** Funnel conversion reports, the same figures the funnel page shows. */
  funnelPerformance: FunnelPerformance;
  /** One page's heatmap analysed, for `get_heatmap_insights`. */
  heatmapAnalysis: HeatmapPageAnalysisReads;
  /** Frustration signals and summaries per recorded session, for the session tools. */
  sessionAnalysis: SessionAnalysisReads;
  /**
   * The gateway's `/internal/notify`, which mails the weekly digest. `null` without a gateway
   * (OSS): there is then nobody to send it, and the digest job is not scheduled.
   */
  notify: { url: string; apiKey: string } | null;
  /** Counts for the hourly anomaly check: traffic and goals, and error groups. */
  anomalyReads?: { traffic: AnalyticsAnomalyReads; errors: ErrorAnomalyReads };
  /**
   * The recommendations loop's readings: fixed-window session counts (analytics) and an
   * automation's execution totals (automations). Without them recommendations are not wired.
   */
  impact?: { reads: AnalyticsImpactReads; automationStats: Pick<AutomationInsights, "stats"> | null };
  /** Validates funnel drafts for `propose_funnel`; the tool is absent without it. */
  funnelDrafts?: FunnelDraftPort;
}): AiModule {
  // One repository for both: the usage counter reads the same table.
  const repo = new PostgresAiRepository();

  /*
   * Provider is read from the environment, not compiled in. `null` means AI is not
   * configured, which must not stop the application booting — every other module works
   * without a model key, and the routes answer "unavailable" instead.
   */
  const providerConfig = readAiProviderConfig();
  const llm = createLlmClient(providerConfig);
  const runner = new NaturalLanguageQueryService(
    repo,
    llm ?? unconfiguredLlm(),
    providerConfig
      ? {
          model: providerConfig.model,
          inputCostPerToken: providerConfig.inputCostPerToken,
          outputCostPerToken: providerConfig.outputCostPerToken,
        }
      : undefined,
  );

  /*
   * Reads and one propose tool. The registry is the agent's entire vocabulary: it can
   * answer from these and draft from that, and there is nothing else it could call.
   */
  const q = (days: number) => ({ days: String(days) }) as never;
  const fixed = sqlBackedReads(repo);
  const funnels = funnelReads({ definitions: fixed.funnels, performance: deps.funnelPerformance });
  const reads: ReadPorts = {
    trafficSummary: (id, days) => deps.analyticsReads.getDashboard(id, q(days)),
    topPages:       (id, days) => deps.analyticsReads.getPages(id, q(days)),
    topSources:     (id, days) => deps.analyticsReads.getSources(id, q(days)),
    dimensions:     (id, days) => deps.analyticsReads.getDimensionsBulk(id, q(days)),
    revenue:        (id, days) => deps.analyticsReads.getRevenueDashboard(id, q(days)),
    errorGroups:    (id, days) => deps.errorQueries.listGroups(id, { days }),
    funnels:           funnels.funnels,
    funnelPerformance: funnels.funnelPerformance,
    automations:       fixed.automations,
    heatmapPages:      fixed.heatmapPages,
    recentSessions:    fixed.recentSessions,
  };

  const registry = new ToolRegistry([
    ...readTools(reads),
    heatmapInsightsTool(deps.heatmapAnalysis),
    ...sessionTools(deps.sessionAnalysis),
    proposeAutomationTool(deps.automationDrafts, deps.automationDrafts.vocabulary()),
    ...(deps.funnelDrafts ? [proposeFunnelTool(deps.funnelDrafts)] : []),
    ...(deps.websitesModule.goalDrafts ? [proposeGoalTool(deps.websitesModule.goalDrafts)] : []),
    // Read lazily: the service is composed below, once the insight model it words with exists.
    ...(deps.impact ? recommendationTools({
      list: (id, statuses) => recommendations!.reads.list(id, statuses),
      get: (id, recId) => recommendations!.reads.get(id, recId),
    }) : []),
  ]);

  const modelInfo = providerConfig
    ? {
        model: providerConfig.model,
        inputCostPerToken: providerConfig.inputCostPerToken,
        outputCostPerToken: providerConfig.outputCostPerToken,
      }
    : { model: "unconfigured", inputCostPerToken: 0, outputCostPerToken: 0 };

  /*
   * Daily insights use their own, cheaper model: they are routine, so the provider's cheap tier
   * (Haiku on Anthropic, gpt-6-luna on OpenAI) unless AI_INSIGHTS_MODEL names one. Priced by AI_INSIGHTS_*_COST_PER_TOKEN, so the
   * cost column is only as accurate as the rate given; the token counts are always real.
   */
  const insightEnv = {
    ...process.env,
    AI_MODEL: process.env.AI_INSIGHTS_MODEL?.trim()
      || BACKGROUND_MODEL[resolveAiProvider()]
      || process.env.AI_MODEL,
    AI_INPUT_COST_PER_TOKEN: process.env.AI_INSIGHTS_INPUT_COST_PER_TOKEN ?? process.env.AI_INPUT_COST_PER_TOKEN,
    AI_OUTPUT_COST_PER_TOKEN: process.env.AI_INSIGHTS_OUTPUT_COST_PER_TOKEN ?? process.env.AI_OUTPUT_COST_PER_TOKEN,
    // Three short lines: far below the chat default.
    AI_MAX_OUTPUT_TOKENS: process.env.AI_INSIGHTS_MAX_OUTPUT_TOKENS ?? "600",
  } as NodeJS.ProcessEnv;
  const insightConfig = readAiProviderConfig(insightEnv);
  const insightLlm = createLlmClient(insightConfig);
  const insights = new InsightService({
    snapshot: (websiteId, days) => readInsightSnapshot({ analytics: deps.analyticsInsights, errors: deps.errorQueries }, websiteId, days),
    repo: new PostgresInsightRepository(),
    llm: insightLlm,
    model: insightConfig
      ? { name: insightConfig.model, inputCostPerToken: insightConfig.inputCostPerToken, outputCostPerToken: insightConfig.outputCostPerToken }
      : null,
  });
  const maxSites = Number(process.env.AI_INSIGHTS_MAX_SITES ?? 5000);

  /*
   * Heatmap insights: the same cheap model as the daily insight, worded on demand when a heatmap
   * is opened and stored. Up to five findings with fixes, so a little more room to answer in.
   */
  const heatmapConfig = readAiProviderConfig({
    ...insightEnv,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_HEATMAP_INSIGHTS_MAX_OUTPUT_TOKENS ?? "900",
  } as NodeJS.ProcessEnv);
  const heatmapNarrator = new HeatmapInsightService({
    repo: new PostgresHeatmapInsightRepository(),
    llm: createLlmClient(heatmapConfig),
    model: heatmapConfig
      ? { name: heatmapConfig.model, inputCostPerToken: heatmapConfig.inputCostPerToken, outputCostPerToken: heatmapConfig.outputCostPerToken }
      : null,
    dailyCap: Number(process.env.AI_HEATMAP_INSIGHTS_DAILY_CAP ?? 60),
  });

  /*
   * Session summaries: the same cheap model by default (AI_SESSION_SUMMARY_MODEL to change it), a
   * few sentences and three moments. `null` without a model: the recordings module then serves
   * signals only and the replay page hides the summary.
   */
  const summaryConfig = readAiProviderConfig({
    ...insightEnv,
    AI_MODEL: process.env.AI_SESSION_SUMMARY_MODEL?.trim() || insightEnv.AI_MODEL,
    AI_INPUT_COST_PER_TOKEN: process.env.AI_SESSION_SUMMARY_INPUT_COST_PER_TOKEN ?? insightEnv.AI_INPUT_COST_PER_TOKEN,
    AI_OUTPUT_COST_PER_TOKEN: process.env.AI_SESSION_SUMMARY_OUTPUT_COST_PER_TOKEN ?? insightEnv.AI_OUTPUT_COST_PER_TOKEN,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_SESSION_SUMMARY_MAX_OUTPUT_TOKENS ?? "700",
  } as NodeJS.ProcessEnv);
  const summaryLlm = createLlmClient(summaryConfig);
  const sessionSummarizer = summaryLlm && summaryConfig
    ? new SessionSummaryService({
        llm: summaryLlm,
        model: { name: summaryConfig.model, inputCostPerToken: summaryConfig.inputCostPerToken, outputCostPerToken: summaryConfig.outputCostPerToken },
      })
    : null;

  /*
   * Anomaly alerts: detection is deterministic and runs without a model; the cheap insight model,
   * when configured, only adds one sentence of likely cause (AI_ANOMALY_MAX_OUTPUT_TOKENS). Mailed
   * through the gateway like the digest; without one they only show on the dashboard.
   */
  const anomalyConfig = readAiProviderConfig({
    ...insightEnv,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_ANOMALY_MAX_OUTPUT_TOKENS ?? "200",
  } as NodeJS.ProcessEnv);
  const anomalies = deps.anomalyReads
    ? new AnomalyService({
        repo: new PostgresAnomalyRepository(),
        traffic: deps.anomalyReads.traffic,
        errors: deps.anomalyReads.errors,
        describeSite: (id) => deps.websitesModule.insightSites.getDigestSite(id),
        send: deps.notify ? gatewayAlertSender(deps.notify) : null,
        explainer: new AnomalyExplainer({
          llm: createLlmClient(anomalyConfig),
          model: anomalyConfig
            ? { name: anomalyConfig.model, inputCostPerToken: anomalyConfig.inputCostPerToken, outputCostPerToken: anomalyConfig.outputCostPerToken }
            : null,
        }),
        alertOps: (title, details) => alertOps(title, details),
      })
    : null;
  // The candidate list is a sum over every site's daily counts: re-read every few hours, not every run.
  let anomalySites: { at: number; ids: string[] } | null = null;

  /*
   * Recommendations: collected daily from the insight lines, heatmap fixes and frustrated sessions,
   * acted on through the assistant, and measured 7 and 14 days after. Rule-based throughout; the
   * insight model, when configured, only words one sentence per reading.
   */
  const recommendations = deps.impact
    ? composeRecommendations({
        impactReads: deps.impact.reads,
        automationStats: deps.impact.automationStats,
        funnelPerformance: deps.funnelPerformance,
        sessionAnalysis: deps.sessionAnalysis,
        latestInsight: (websiteId) => insights.latest(websiteId),
        llm: insightLlm,
      })
    : null;

  const agent = new AgentService(repo, llm ?? unconfiguredLlm(), registry, modelInfo);
  // A confirmed draft marks its recommendation applied (or records itself), so its impact is measured.
  const applier = new ProposalApplier(
    repo,
    deps.writers,
    recommendations ? async (applied) => { await recommendations.service.recordApplied(applied); } : undefined,
  );

  return {
    heatmapNarrator,
    sessionSummarizer,
    usage: new AiUsageCounter(repo),
    retention: new AiRetentionPurge(),
    routes: createAiRoutes({
      query: runner,
      history: runner,
      agent,
      applier,
      websites: deps.websitesModule.accessChecks,
      insights,
      alerts: anomalies ?? undefined,
      recommendations: recommendations?.service,
      configured: llm !== null,
    }),
    insights: {
      runDaily: async () => {
        // Only sites with recent traffic, busiest first: a site with no events has nothing to say.
        const cap = Number.isFinite(maxSites) && maxSites > 0 ? Math.trunc(maxSites) : 5000;
        const { websiteIds, truncated } = await deps.websitesModule.insightSites.listInsightCandidateSites({ days: INSIGHT_DAYS, limit: cap });
        if (truncated) log.warn({ msg: "ai_insights_sites_capped", cap, hint: "raise AI_INSIGHTS_MAX_SITES" });
        return insights.runDaily(websiteIds);
      },
    },
    anomalies: {
      enabled: anomalies !== null,
      runHourly: async () => {
        if (!anomalies) return null;
        const cap = Number.isFinite(maxSites) && maxSites > 0 ? Math.trunc(maxSites) : 5000;
        if (!anomalySites || Date.now() - anomalySites.at > 6 * 3_600_000) {
          // Sites with events in the last eight days: one whose tracking broke yesterday is still in.
          const { websiteIds, truncated } = await deps.websitesModule.insightSites.listInsightCandidateSites({ days: 8, limit: cap });
          if (truncated) log.warn({ msg: "ai_anomaly_sites_capped", cap, hint: "raise AI_INSIGHTS_MAX_SITES" });
          anomalySites = { at: Date.now(), ids: websiteIds };
        }
        return anomalies.runHourly(anomalySites.ids);
      },
    },
    recommendations: {
      enabled: recommendations !== null,
      runDaily: async () => {
        if (!recommendations) return null;
        const cap = Number.isFinite(maxSites) && maxSites > 0 ? Math.trunc(maxSites) : 5000;
        const { websiteIds, truncated } = await deps.websitesModule.insightSites.listInsightCandidateSites({ days: INSIGHT_DAYS, limit: cap });
        if (truncated) log.warn({ msg: "ai_recommendations_sites_capped", cap, hint: "raise AI_INSIGHTS_MAX_SITES" });
        return recommendations.service.runDaily(websiteIds);
      },
    },
    digest: {
      enabled: deps.notify !== null,
      runWeekly: async () => {
        if (!deps.notify) return { sent: 0, skipped: 0, failed: 0 };
        const cap = Number.isFinite(maxSites) && maxSites > 0 ? Math.trunc(maxSites) : 5000;
        return runWeeklyDigest({
          listSites: async () => {
            const { websiteIds, truncated } = await deps.websitesModule.insightSites.listInsightCandidateSites({ days: DIGEST_DAYS, limit: cap });
            if (truncated) log.warn({ msg: "ai_digest_sites_capped", cap, hint: "raise AI_INSIGHTS_MAX_SITES" });
            return websiteIds;
          },
          describeSite: (id) => deps.websitesModule.insightSites.getDigestSite(id),
          snapshot: (id, days, end) => deps.analyticsInsights.getInsightSnapshot(id, days, end),
          insights,
          send: gatewayNotifySender(deps.notify),
        });
      },
    },
  };
}

/**
 * Stands in when no provider is configured.
 *
 * Fails at call time with a message naming the fix, rather than at boot. An
 * unconfigured AI module should make the AI page say so, not take the product down.
 */
function unconfiguredLlm(): LlmClient {
  const fail = (): never => {
    throw new Error(
      "AI is not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY (or AI_PROVIDER and AI_API_KEY), " +
      "and AI_BASE_URL for a self-hosted or OpenAI-compatible endpoint.",
    );
  };
  return { complete: fail, classify: fail };
}
