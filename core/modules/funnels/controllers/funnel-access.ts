import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { log } from "../../../platform/observability/logger";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { roleAtLeast, type WebsiteRole } from "../../websites/interfaces";
import type { FunnelControllerDeps } from "./funnel-controller.types";

const funnelLog = log.child({ category: "funnels" });

/** Any member of the site reads; creating, changing or deleting a funnel needs `minimum` ("member"). */
export async function requireFunnelAccess(
  c: Context<{ Variables: AuthVars }>,
  deps: FunnelControllerDeps,
  websiteRef: string,
  minimum: WebsiteRole = "viewer",
): Promise<{ userId: string } | { denied: Response }> {
  const userId = requireUser(c);
  if (!userId) return { denied: c.json({ error: "unauthorized" }, 401) };
  const role = await deps.websites.getRole(websiteRef, userId);
  if (!role || !roleAtLeast(role, minimum)) {
    return { denied: c.json({ error: "forbidden" }, 403 as ContentfulStatusCode) };
  }
  return { userId };
}

export function funnelFailure(c: Context, op: string, websiteRef: string, error: unknown) {
  funnelLog.error({
    msg: "funnel_request_failed",
    op,
    website_id: websiteRef,
    err: error instanceof Error ? error.message : String(error),
  });
  return c.json({ error: "Failed to process funnel request" }, 500);
}
