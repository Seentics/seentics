import type { WebsitesModule } from "../websites/interfaces";
import type { ApiKeysModule } from "./interfaces";
import { createApiKeyRoutes } from "./routes";
import { verifyWebsiteApiKey } from "./services/api-key-verification.service";

export function initApiKeysModule(deps: { websitesModule: WebsitesModule }): ApiKeysModule {
  return {
    routes: createApiKeyRoutes({ websites: deps.websitesModule.query }),
    verifier: { verify: verifyWebsiteApiKey },
  };
}
