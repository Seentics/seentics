import type { WebsitesModule } from "../websites/interfaces";
import type { ApiKeysModule } from "./interfaces";
import { createAccountApiKeyRoutes } from "./account-routes";
import { createEmbedLinkRoutes } from "./embed-routes";
import { verifyAccountApiKey, type AccountActiveCheck } from "./services/account-api-key.service";
import { createRawApiVerifier } from "./services/raw-api-verification.service";
import { embedLinkService } from "./services/embed-link.service";

export function initApiKeysModule(deps: { websitesModule: WebsitesModule; accountActive: AccountActiveCheck }): ApiKeysModule {
  const accountVerifier = { verify: (rawKey: string | undefined) => verifyAccountApiKey(rawKey, deps.accountActive) };
  return {
    verifier: createRawApiVerifier({ accountKeys: accountVerifier, ownedWebsites: deps.websitesModule.ownedWebsites }),
    accountRoutes: createAccountApiKeyRoutes(),
    accountVerifier,
    embedLinks: embedLinkService,
    embedRoutes: createEmbedLinkRoutes({
      embedLinks: embedLinkService,
      websites: deps.websitesModule.accessChecks,
      clients: deps.websitesModule.clients,
    }),
  };
}
