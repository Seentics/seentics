import type { WebsitesModule } from "../websites/interfaces";
import type { AiModule } from "./interfaces";
import { AiUsageCounter } from "./services/usage-count.service";
import { createAiRoutes } from "./routes";
import { AiService } from "./services/ai.service";

/**
 * Build the AI module.
 *
 * Purely a consumer: it reads through other modules' query surfaces and offers no
 * capability anything else needs, which is why `AiModule` is just its routes.
 */
export function initAiModule(deps: { websitesModule: WebsitesModule }): AiModule {
  return {
    usage: new AiUsageCounter(),
    routes: createAiRoutes({ ai: new AiService(deps.websitesModule.query) }),
  };
}
