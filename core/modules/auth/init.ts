import type { AuthModule } from "./interfaces";
import { authRoutes, userAuthRoutes } from "./routes";
import { UserDirectoryService } from "./services/user-directory.service";

/**
 * Build the auth module.
 *
 * Takes nothing: auth depends on no other module, and its routers are still
 * module-level singletons because they hold no injected state. It exists so the two
 * consumers of `users` — the profile endpoint and the websites member list — receive a
 * port instead of importing `services/auth.service.ts`, which is also where password
 * hashing and token signing live.
 */
export function initAuthModule(): AuthModule {
  return {
    users: new UserDirectoryService(),
    routes: authRoutes,
    userRoutes: userAuthRoutes,
  };
}
