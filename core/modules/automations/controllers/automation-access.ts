import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { roleAtLeast, type WebsiteRole } from "../../websites/interfaces";
import type { AutomationControllerDeps } from "./automation-controller.types";

/**
 * Any member of the site reads; creating, changing, switching or deleting an automation needs
 * `minimum` — "member" — because an automation runs on the live site, and a viewer only looks.
 */
export async function requireAutomationAccess(
  c: Context<{ Variables: AuthVars }>,
  deps: AutomationControllerDeps,
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

export function automationResponse(c: Context, value: unknown) {
  if (value instanceof Response) return value;
  if (value === null) return c.json({ error: "not found" }, 404);
  return c.json({ data: value });
}
