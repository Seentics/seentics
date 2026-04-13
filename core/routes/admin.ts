import { Hono } from "hono";
import { authMiddleware, requireUser, type AuthVars } from "../middleware/auth";
import { getUserById } from "../services/auth.service";

const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

r.use("*", async (c, next) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const u = await getUserById(uid);
  if (u?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  return next();
});

r.get("/analytics/stats", (c) => c.json({ data: {} }));

export const adminRoutes = r;
