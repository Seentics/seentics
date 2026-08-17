import { Hono } from "hono";
import type { Context } from "hono";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { log } from "../../platform/lib/logger";
import { parseJson } from "../../platform/validation";
import { aiQueryBodySchema } from "./validators/ai.schema";
import { AIDailyLimitError } from "./services/ai-query.service";
import type { AiAccessCheck, AiQuery, AIDomain } from "./interfaces";

const ai_log = log.child({ category: "ai" });

/** Upper bound on history size, regardless of what the client asks for. */
const MAX_HISTORY = 20;

/**
 * HTTP surface for natural-language querying, mounted at `/api/v1/ai`.
 *
 * A factory so the service arrives injected. That is also what removed this module's
 * two reads of the websites table: resolution and the access check now go through the
 * websites module's ports rather than `platform/lib/website-resolve` and a hand-rolled
 * owner-or-member query.
 */
export function createAiRoutes(deps: { ai: AiQuery & AiAccessCheck }) {
  const { ai } = deps;
  const r = new Hono<{ Variables: AuthVars }>();

  r.use("*", authMiddleware);

  /**
   * Authenticate and confirm the user may query this website.
   *
   * Runs before the LLM call rather than after, because a query costs real money and
   * consumes the user's daily quota. The message is deliberately the same for a
   * website that does not exist and one the caller cannot see.
   */
  async function denyUnlessPermitted(
    c: Context<{ Variables: AuthVars }>,
    websiteRef: string,
  ): Promise<Response | null> {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    if (!(await ai.userCanQuery(websiteRef, userId))) {
      return c.json({ error: "website not found or access denied" }, 403);
    }
    return null;
  }

  r.post("/query/:website_id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const websiteRef = c.req.param("website_id");

    const parsed = await parseJson(c, aiQueryBodySchema);
    if (!parsed.ok) return parsed.res;

    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    try {
      const domain = (parsed.data.domain ?? "analytics") as AIDomain;
      const result = await ai.runQuery(userId, websiteRef, parsed.data.prompt, domain);
      return c.json({ data: result });
    } catch (err) {
      if (err instanceof AIDailyLimitError) {
        return c.json({ error: "Daily AI query limit reached. Try again later." }, 429);
      }

      const message = err instanceof Error ? err.message : "AI query failed";
      if (message.includes("not configured") || message.includes("API key")) {
        return c.json({ error: "AI is not available — API key not configured." }, 503);
      }

      // Logged in full, returned generically: the message can carry generated SQL and
      // table names, which must not reach the client.
      ai_log.error({ msg: "ai_query_failed", website_id: websiteRef, err: message });
      return c.json({ error: "AI query failed" }, 500);
    }
  });

  r.get("/history/:website_id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const requested = Number.parseInt(c.req.query("limit") ?? "8", 10) || 8;
    const history = await ai.getHistory(userId, websiteRef, Math.min(requested, MAX_HISTORY));
    return c.json({ data: history });
  });

  return r;
}
