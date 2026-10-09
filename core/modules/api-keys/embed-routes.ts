/**
 * Minting embed tokens from the dashboard — `/user/agency/embed-tokens`.
 *
 * An embed shows a website's numbers to whoever can load the page it sits on, so it takes
 * the role that may publish a site's analytics: admin or owner, the same bar as a public
 * share link.
 */

import { Hono } from "hono";
import { z } from "zod";
import { env } from "../../config";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { parseJson } from "../../platform/validation";
import { roleAtLeast, type WebsiteQuery } from "../websites/interfaces";
import { EMBED_TTL_MAX_SECONDS, EMBED_TTL_MIN_SECONDS, issueEmbedToken } from "./services/embed-token.service";

export const embedTokenRequestSchema = z.object({
  expires_in_seconds: z.number().int().min(EMBED_TTL_MIN_SECONDS).max(EMBED_TTL_MAX_SECONDS).optional(),
});

/** What every embed-token response carries: the token and a ready-made iframe URL. */
export async function embedTokenResponse(websiteId: string, ttlSeconds?: number) {
  const { token, expiresAt } = await issueEmbedToken(websiteId, ttlSeconds);
  return {
    token,
    expires_at: expiresAt.toISOString(),
    embed_url: `${env().frontendUrl}/embed/${websiteId}?token=${token}`,
  };
}

export function createEmbedTokenRoutes(deps: { websites: WebsiteQuery }) {
  const r = new Hono<{ Variables: AuthVars }>();
  r.use("*", authMiddleware);

  r.post("/", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const parsed = await parseJson(c, embedTokenRequestSchema.extend({ website_id: z.string().uuid() }));
    if (!parsed.ok) return parsed.res;

    const role = await deps.websites.getRole(parsed.data.website_id, userId);
    if (!role || !roleAtLeast(role, "admin")) return c.json({ error: "forbidden" }, 403);

    return c.json({ data: await embedTokenResponse(parsed.data.website_id, parsed.data.expires_in_seconds) }, 201);
  });

  return r;
}
