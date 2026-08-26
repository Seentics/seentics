import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AuthModule } from "../../modules/auth/interfaces";
import { createUserProfileRoutes } from "./user-profiles";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import type { WebsiteInvitations } from "../../modules/websites/interfaces";

/**
 * The `/api/v1/user` branch: auth, profiles, and a second mount of the websites
 * router.
 *
 * A factory because every router mounted here is built by the composition root — each
 * needs its dependencies injected, and this file holds none of them itself.
 */
export function createUserBranchRoutes(deps: {
  websites: Hono<{ Variables: AuthVars }>;
  /**
   * Invitation acceptance, as a port.
   *
   * This file used to import `acceptInvitationByToken` out of
   * `modules/websites/services/members` — a platform-layer HTTP file reaching into a
   * module's internals for one function on a write path.
   */
  invitations: WebsiteInvitations;
  /** Auth's two contributions here: its session router and the user lookup. */
  authModule: AuthModule;
}) {
  const user = new Hono<{ Variables: AuthVars }>();

  user.route("/auth", deps.authModule.userRoutes);
  user.route("/websites", deps.websites);
  user.route("/users", createUserProfileRoutes({ users: deps.authModule.users }));

  /**
   * Accepting an invitation is deliberately outside the websites router: the caller
   * holds only a token and has no website reference yet, so it cannot pass the
   * per-website access guard those routes apply.
   */
  user.post("/accept-invite", authMiddleware, async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json<{ token?: string }>().catch((): { token?: string } => ({}));
    if (!body.token) return c.json({ error: "token is required" }, 400);

    try {
      return c.json(await deps.invitations.acceptByToken(userId, body.token));
    } catch (e) {
      const status = (e as Error & { status?: number }).status ?? 400;
      return c.json(
        { error: e instanceof Error ? e.message : "failed" },
        status as ContentfulStatusCode,
      );
    }
  });

  return user;
}
