import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { userAuthRoutes } from "./auth";
import { websiteRoutes } from "./websites";
import { userProfileRoutes } from "./user-profiles";
import { authMiddleware, requireUser, type AuthVars } from "../middleware/auth";
import * as ws from "../services/websites.service";

const user = new Hono<{ Variables: AuthVars }>();
user.route("/auth", userAuthRoutes);
user.route("/websites", websiteRoutes);
user.route("/users", userProfileRoutes);

user.post("/accept-invite", authMiddleware, async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<{ token?: string }>().catch((): { token?: string } => ({}));
  if (!b.token) return c.json({ error: "token is required" }, 400);
  try {
    return c.json(await ws.acceptInvitationByToken(uid, b.token));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const st = (e as Error & { status?: number }).status ?? 400;
    return c.json({ error: msg }, st as ContentfulStatusCode);
  }
});

export const userBranchRoutes = user;
