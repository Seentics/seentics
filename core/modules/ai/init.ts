import type { AnalyticsInsightReads, AnalyticsReads } from "../analytics/interfaces";
import type { RetentionSiteSource } from "../../platform/retention";
import type { AutomationDraftValidator } from "../automations/interfaces/automations.module";
import type { ErrorQueries } from "../errors/interfaces";
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
import { proposeAutomationTool } from "./tools/propose-automation.tool";
import { NaturalLanguageQueryService } from "./services/natural-language-query.service";
import { createLlmClient, readAiProviderConfig } from "./services/llm";
import { PostgresAiRepository } from "./repositories/postgres-ai.repository";
import { InsightService } from "./insights/service";
import { PostgresInsightRepository } from "./insights/postgres-repository";
import { readInsightSnapshot } from "./insights/snapshot";

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
  const reads: ReadPorts = {
    trafficSummary: (id, days) => deps.analyticsReads.getDashboard(id, q(days)),
    topPages:       (id, days) => deps.analyticsReads.getPages(id, q(days)),
    topSources:     (id, days) => deps.analyticsReads.getSources(id, q(days)),
    dimensions:     (id, days) => deps.analyticsReads.getDimensionsBulk(id, q(days)),
    revenue:        (id, days) => deps.analyticsReads.getRevenueDashboard(id, q(days)),
    errorGroups:    (id, days) => deps.errorQueries.listGroups(id, { days }),
    funnels:           fixed.funnels,
    funnelPerformance: (id, funnelId) => fixed.funnelPerformance(id, funnelId),
    automations:       fixed.automations,
    heatmapPages:      fixed.heatmapPages,
    recentSessions:    fixed.recentSessions,
  };

  const registry = new ToolRegistry([
    ...readTools(reads),
    proposeAutomationTool(deps.automationDrafts, deps.automationDrafts.vocabulary()),
  ]);

  const modelInfo = providerConfig
    ? {
        model: providerConfig.model,
        inputCostPerToken: providerConfig.inputCostPerToken,
        outputCostPerToken: providerConfig.outputCostPerToken,
      }
    : { model: "unconfigured", inputCostPerToken: 0, outputCostPerToken: 0 };

  /*
   * Daily insights use their own, cheaper model: they are routine, so Haiku-class by default on
   * Anthropic, or whatever AI_INSIGHTS_MODEL names. Priced by AI_INSIGHTS_*_COST_PER_TOKEN, so the
   * cost column is only as accurate as the rate given; the token counts are always real.
   */
  const insightEnv = {
    ...process.env,
    AI_MODEL: process.env.AI_INSIGHTS_MODEL?.trim()
      || ((process.env.AI_PROVIDER ?? "").trim().toLowerCase() === "anthropic" ? "claude-haiku-5-5" : process.env.AI_MODEL),
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

  const agent = new AgentService(repo, llm ?? unconfiguredLlm(), registry, modelInfo);
  const applier = new ProposalApplier(repo, deps.writers);

  return {
    usage: new AiUsageCounter(repo),
    retention: new AiRetentionPurge(),
    routes: createAiRoutes({
      query: runner,
      history: runner,
      agent,
      applier,
      websites: deps.websitesModule.accessChecks,
      insights,
    }),
    insights: {
      runDaily: async () => {
        const sites = (await deps.sites.listAllSites()).map((s) => s.websiteId).slice(0, Number.isFinite(maxSites) ? maxSites : 5000);
        return insights.runDaily(sites);
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
      "AI is not configured. Set AI_PROVIDER and AI_API_KEY (or OPENAI_API_KEY), " +
      "and AI_BASE_URL for a self-hosted or OpenAI-compatible endpoint.",
    );
  };
  return { complete: fail, classify: fail };
}
