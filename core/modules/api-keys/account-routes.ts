/**
 * Managing account API keys from the dashboard — `/user/agency/api-keys`.
 *
 * Keys belong to the signed-in account and are only ever listed, minted and revoked by
 * it: there is no website to authorize against, so the owner is the whole check.
 */

import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { parseJson } from "../../platform/validation";
import { ACCOUNT_SCOPES, ACCOUNT_SCOPE_DESCRIPTIONS, type AccountScope } from "./interfaces";
import { createAccountApiKey, listAccountApiKeys, revokeAccountApiKey } from "./services/account-api-key.service";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** Omitted: every scope — the dashboard's form only asks for a name. */
  scopes: z.array(z.enum(ACCOUNT_SCOPES)).min(1).optional(),
});

export function createAccountApiKeyRoutes() {
  const r = new Hono<{ Variables: AuthVars }>();
  r.use("*", authMiddleware);

  r.get("/scopes", (c) =>
    c.json({ data: ACCOUNT_SCOPES.map((scope) => ({ scope, description: ACCOUNT_SCOPE_DESCRIPTIONS[scope] })) }),
  );

  r.get("/", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    return c.json({ data: await listAccountApiKeys(userId) });
  });

  /** 201 with `key` — the only time the secret is ever returned. */
  r.post("/", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const parsed = await parseJson(c, createSchema);
    if (!parsed.ok) return parsed.res;
    const scopes = (parsed.data.scopes ?? [...ACCOUNT_SCOPES]) as AccountScope[];
    return c.json({ data: await createAccountApiKey(userId, parsed.data.name, scopes) }, 201);
  });

  r.delete("/:keyId", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const removed = await revokeAccountApiKey(userId, c.req.param("keyId"));
    return removed ? c.body(null, 204) : c.json({ error: "not found" }, 404);
  });

  return r;
}
