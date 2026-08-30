/**
 * Managing API keys from the dashboard.
 *
 * Mounted under the websites router's paths so the client's URLs are unchanged, but
 * implemented here because `api_keys` is a platform-owned table — the websites module
 * must not query it, and the stubs it carried (a `GET` returning `[]`, a `POST`
 * returning 501) were a placeholder for exactly this.
 *
 * Authorization is by *website role*, not by who created the key. A key grants access to
 * a website's data, so anyone who may read that website may see which keys exist; anyone
 * who may administer it may mint and revoke them.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../middleware/auth";
import { parseJson } from "../../validation";
import type { WebsiteQuery } from "../../../modules/websites/interfaces";
import { apiKeyCreateSchema } from "./api-key.schema";
import {
  API_SCOPES,
  SCOPE_DESCRIPTIONS,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiScope,
} from "./api-key.service";

type ApiKeyContext = Context<{ Variables: AuthVars }>;

export function createApiKeyRoutes(deps: { websites: WebsiteQuery }) {
  const { websites } = deps;
  const r = new Hono<{ Variables: AuthVars }>();

  r.use("*", authMiddleware);

  /**
   * Confirm the caller may act on this website's keys.
   *
   * Answers 403 for a website that does not exist as well as one the caller cannot see,
   * so the endpoint cannot be used to discover which site ids are real — the same rule
   * the analytics and automations routers follow.
   */
  async function denyUnlessPermitted(c: ApiKeyContext, websiteRef: string): Promise<Response | null> {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const role = await websites.getRole(websiteRef, userId);
    if (!role) return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);

    return null;
  }

  /** The scopes a key may carry, so the form is built from the server's list. */
  r.get("/scopes", (c) =>
    c.json({
      data: API_SCOPES.map((scope) => ({ scope, description: SCOPE_DESCRIPTIONS[scope] })),
    }),
  );

  r.get("/:websiteId/api-keys", async (c) => {
    const websiteId = c.req.param("websiteId");
    const denied = await denyUnlessPermitted(c, websiteId);
    if (denied) return denied;

    return c.json({ data: await listApiKeys(websiteId) });
  });

  /**
   * Mint a key.
   *
   * 201 with the secret in the body — the only time it is ever returned. The client has
   * to show it immediately, because nothing can retrieve it afterwards.
   */
  r.post("/:websiteId/api-keys", async (c) => {
    const websiteId = c.req.param("websiteId");
    const denied = await denyUnlessPermitted(c, websiteId);
    if (denied) return denied;

    const parsed = await parseJson(c, apiKeyCreateSchema);
    if (!parsed.ok) return parsed.res;

    const created = await createApiKey(
      websiteId,
      // Present because `denyUnlessPermitted` already ran the auth check.
      requireUser(c)!,
      parsed.data.name,
      parsed.data.scopes as ApiScope[],
    );
    return c.json({ data: created }, 201);
  });

  /** Revoke. 404 when the key does not belong to this website, rather than a silent 204. */
  r.delete("/:websiteId/api-keys/:keyId", async (c) => {
    const websiteId = c.req.param("websiteId");
    const denied = await denyUnlessPermitted(c, websiteId);
    if (denied) return denied;

    const removed = await revokeApiKey(websiteId, c.req.param("keyId") ?? "");
    if (!removed) return c.json({ error: "not found" }, 404);

    return c.body(null, 204);
  });

  return r;
}
