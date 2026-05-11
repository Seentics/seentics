import { Hono } from "hono";
import { authMiddleware, requireUser, type AuthVars } from "../middleware/auth";
import { parseJson } from "../validators/validation";
import { aiQueryBodySchema } from "../validators/ai";
import { checkWebsiteAccess, getAIQueryHistory, runAIQuery } from "../services/ai.service";
import type { AIDomain } from "../services/ai/shared";

const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

r.post("/query/:website_id", async (c) => {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  const websiteId = c.req.param("website_id");

  const parsed = await parseJson(c, aiQueryBodySchema);
  if (!parsed.ok) return parsed.res;

  const hasAccess = await checkWebsiteAccess(websiteId, userId);
  if (!hasAccess) return c.json({ error: "website not found or access denied" }, 403);

  try {
    const domain = (parsed.data.domain ?? "analytics") as AIDomain;
    const result = await runAIQuery(userId, websiteId, parsed.data.prompt, domain);
    return c.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI query failed";
    return c.json({ error: message }, 500);
  }
});

r.get("/history/:website_id", async (c) => {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  const websiteId = c.req.param("website_id");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "8", 10) || 8, 20);

  const hasAccess = await checkWebsiteAccess(websiteId, userId);
  if (!hasAccess) return c.json({ error: "website not found or access denied" }, 403);

  const history = await getAIQueryHistory(userId, websiteId, limit);
  return c.json({ data: history });
});

export { r as aiRoutes };
