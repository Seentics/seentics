import type { Context } from "hono";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { AgencyOperationError, type AgencyFailure } from "../interfaces";

export type Ctx = Context<{ Variables: AuthVars }>;

const FAILURE_STATUS: Record<AgencyFailure, 404 | 409> = {
  client_not_found: 404,
  client_user_not_found: 404,
  client_user_exists: 409,
  client_user_revoked: 409,
};

/**
 * Resolve the owner — the signed-in user, acting on their own agency — and answer a
 * refused operation with its status rather than a 500.
 */
export function guarded(run: (c: Ctx, ownerId: string) => Promise<Response>) {
  return async (c: Ctx) => {
    const ownerId = requireUser(c);
    if (!ownerId) return c.json({ error: "unauthorized" }, 401);
    try {
      return await run(c, ownerId);
    } catch (e) {
      if (e instanceof AgencyOperationError) return c.json({ error: e.reason }, FAILURE_STATUS[e.reason]);
      throw e;
    }
  };
}

export const notFound = (c: Ctx) => c.json({ error: "not found" }, 404);
