import type { AnalyticsReads } from "../analytics/interfaces";
import type { AutomationDraftValidator } from "../automations/interfaces/automations.module";
import type { ErrorQueries } from "../errors/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { AiModule } from "./interfaces";
import type { LlmClient } from "./interfaces/llm-client.interface";
import { AiUsageCounter } from "./services/usage-count.service";
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

  const agent = new AgentService(repo, llm ?? unconfiguredLlm(), registry, modelInfo);
  const applier = new ProposalApplier(repo, deps.writers);

  return {
    usage: new AiUsageCounter(repo),
    routes: createAiRoutes({
      query: runner,
      history: runner,
      agent,
      applier,
      websites: deps.websitesModule.accessChecks,
    }),
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
