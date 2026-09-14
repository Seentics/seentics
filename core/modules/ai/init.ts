import type { WebsitesModule } from "../websites/interfaces";
import type { AiModule } from "./interfaces";
import type { LlmClient } from "./interfaces/llm-client.interface";
import { AiUsageCounter } from "./services/usage-count.service";
import { createAiRoutes } from "./routes";
import { NaturalLanguageQueryService } from "./services/natural-language-query.service";
import { createLlmClient, readAiProviderConfig } from "./services/llm";
import { PostgresAiRepository } from "./repositories/postgres-ai.repository";

/**
 * Build the AI module.
 *
 * Purely a consumer: it reads through other modules' query surfaces and offers no
 * capability anything else needs, which is why `AiModule` is just its routes.
 */
export function initAiModule(deps: { websitesModule: WebsitesModule }): AiModule {
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

  return {
    usage: new AiUsageCounter(repo),
    routes: createAiRoutes({
      query: runner,
      history: runner,
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
