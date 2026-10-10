import type { AuthedRouter } from "../../../platform/http/router";
import type { AccountKeyVerifier, ApiKeyVerifier, EmbedLinks } from "./api-key.interface";

export interface ApiKeysModule {
  /** The public data API's credential check: an account key plus ownership of the website. */
  verifier: ApiKeyVerifier;
  /** The dashboard's account-key screens (`/user/agency/api-keys`), behind the session. */
  accountRoutes: AuthedRouter;
  accountVerifier: AccountKeyVerifier;
  embedLinks: EmbedLinks;
  /** The dashboard's embed screen (`/user/agency/embed-links`), behind the session. */
  embedRoutes: AuthedRouter;
}
