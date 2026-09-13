import type { AuthedRouter } from "../../../platform/http/router";
import type { ApiKeyVerifier } from "./api-key.interface";

export interface ApiKeysModule {
  routes: AuthedRouter;
  verifier: ApiKeyVerifier;
}
