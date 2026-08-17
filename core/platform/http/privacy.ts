import { Hono } from "hono";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";

const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

r.get("/export/:user_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: [] });
});

r.get("/export/website/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: [] });
});

r.post("/import/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { ok: true } });
});

r.delete("/delete/:user_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.body(null, 204);
});

r.delete("/delete/website/:website_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.body(null, 204);
});

r.put("/anonymize/:user_id", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { ok: true } });
});

r.get("/retention-policies", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: [] });
});

r.post("/cleanup", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { ok: true } });
});

export const privacyRoutes = r;
