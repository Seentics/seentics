import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { userAuthRoutes } from "../../modules/auth/routes";
import { userProfileRoutes } from "./user-profiles";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { acceptInvitationByToken } from "../../modules/websites/services/members";

/**
 * The `/api/v1/user` branch: auth, profiles, and a second mount of the websites
 * router.
 *
 * A factory because the websites router is built by the composition root and can no
 * longer be imported — it needs `WebsiteService` injected. `auth` and `user-profiles`
 * are still module-level routers; they become parameters here when those areas are
 * migrated.
 */
export function createUserBranchRoutes(deps: {
  websites: Hono<{ Variables: AuthVars }>;
}) {
  const user = new Hono<{ Variables: AuthVars }>();

  user.route("/auth", userAuthRoutes);
  user.route("/websites", deps.websites);
  user.route("/users", userProfileRoutes);

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
      return c.json(await acceptInvitationByToken(userId, body.token));
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
