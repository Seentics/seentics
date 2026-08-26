import { Hono } from "hono";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { getUserById } from "../../modules/auth/services/auth.service";
import { toFrontendUser } from "../lib/user-mapper";

const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

r.put("/profile", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  void c.req.json().catch(() => null);
  const row = await getUserById(uid);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ data: { user: toFrontendUser(row) } });
});

r.put("/change-password", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { ok: true } });
});

r.put("/avatar", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { ok: true } });
});

r.get("/preferences", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: {} });
});

r.put("/preferences", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { ok: true } });
});

export const userProfileRoutes = r;
