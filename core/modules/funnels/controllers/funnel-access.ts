import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { log } from "../../../platform/observability/logger";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { roleAtLeast, type WebsiteRole } from "../../websites/interfaces";
import { permissionDenied, roleAllows, type Permission } from "../../../platform/permissions";
import type { FunnelControllerDeps } from "./funnel-controller.types";

const funnelLog = log.child({ category: "funnels" });

/**
 * Any member of the site reads; creating, changing or deleting a funnel needs `minimum` ("member").
 *
 * Then the team permission, the same second check `requireWebsiteAccess` makes: a read needs
 * `analytics:funnels.view` and anything above a viewer's reach needs `analytics:funnels.manage`.
 * The website role says whether this person may touch the site; the permission says whether
 * their team narrowed that, which only the gateway knows. Both keys were defined and granted by
 * the gateway's roles and checked nowhere, so a custom role without them changed nothing.
 */
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
  const permission: Permission = minimum === "viewer" ? "analytics:funnels.view" : "analytics:funnels.manage";
  if (!roleAllows(role, permission)) {
    return { denied: c.json({ error: "forbidden" }, 403 as ContentfulStatusCode) };
  }
  const denied = permissionDenied(c, permission);
  if (denied) return { denied };
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
