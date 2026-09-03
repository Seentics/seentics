import type { WebsitesModule } from "../websites/interfaces";
import type { AiModule } from "./interfaces";
import { AiUsageCounter } from "./services/usage-count.service";
import { createAiRoutes } from "./routes";
import { AiService } from "./services/ai.service";
import { AiQueryRunner } from "./services/ai-query.service";
import { OpenAiClient } from "./services/openai-client";
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
  const runner = new AiQueryRunner(repo, new OpenAiClient());

  return {
    usage: new AiUsageCounter(repo),
    routes: createAiRoutes({ ai: new AiService(deps.websitesModule.query, runner) }),
  };
}
