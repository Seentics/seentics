import type { AuthedRouter } from "../../../platform/http/router";
import type { AccountKeyVerifier, ApiKeyVerifier, EmbedTokenIssuer, WebsiteKeyIssuer } from "./api-key.interface";

export interface ApiKeysModule {
  routes: AuthedRouter;
  verifier: ApiKeyVerifier;
  /** The dashboard's account-key screens (`/user/agency/api-keys`), behind the session. */
  accountRoutes: AuthedRouter;
  accountVerifier: AccountKeyVerifier;
  websiteKeys: WebsiteKeyIssuer;
  embedTokens: EmbedTokenIssuer;
  /** The dashboard's embed screen (`/user/agency/embed-tokens`), behind the session. */
  embedRoutes: AuthedRouter;
}
