import type { AuthedRouter, PublicRouter } from "../../../platform/http/router";
import type { UserDirectory } from "./auth.interface";

/**
 * Everything the auth module offers.
 *
 * `routes` and `userRoutes` are two mounts of the same area: `/api/v1/auth` for
 * register/login/refresh, and `/api/v1/user/auth` for the session-scoped variants.
 */
export interface AuthModule {
  /** Reading people. The only capability another module needs. */
  users: UserDirectory;

  /**
   * `/api/v1/auth` — register, login, refresh. No auth context: this is the router
   * that establishes one.
   */
  routes: PublicRouter;

  /** `/api/v1/user/auth` — the session-scoped variants, behind `authMiddleware`. */
  userRoutes: AuthedRouter;
}
