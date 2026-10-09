import type { WebsitesModule } from "../websites/interfaces";
import type { ApiKeysModule } from "./interfaces";
import { createAccountApiKeyRoutes } from "./account-routes";
import { createEmbedTokenRoutes } from "./embed-routes";
import { createApiKeyRoutes } from "./routes";
import { verifyAccountApiKey } from "./services/account-api-key.service";
import { createApiKey } from "./services/api-key.service";
import { verifyWebsiteApiKey } from "./services/api-key-verification.service";
import { embedTokens } from "./services/embed-token.service";

export function initApiKeysModule(deps: { websitesModule: WebsitesModule }): ApiKeysModule {
  return {
    routes: createApiKeyRoutes({ websites: deps.websitesModule.query }),
    verifier: { verify: verifyWebsiteApiKey },
    accountRoutes: createAccountApiKeyRoutes(),
    accountVerifier: { verify: verifyAccountApiKey },
    websiteKeys: { create: createApiKey },
    embedTokens,
    embedRoutes: createEmbedTokenRoutes({ websites: deps.websitesModule.accessChecks }),
  };
}
