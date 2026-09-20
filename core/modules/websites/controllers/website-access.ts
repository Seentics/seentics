import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { roleAtLeast, type WebsiteRole } from "../interfaces";
import { permissionDenied, type Permission } from "../../../platform/permissions";
import type { WebsiteControllerDeps } from "./website-controller.types";

export type WebsiteContext<Path extends string = string> = Context<{ Variables: AuthVars }, Path>;

export function requireWebsiteUser(c: WebsiteContext): string | Response {
  return requireUser(c) ?? c.json({ error: "unauthorized" }, 401);
}

export function websiteDenied(c: Context, error: unknown): Response {
  const status = (error as Error & { status?: number }).status ?? 403;
  return c.json({ error: "forbidden" }, status as ContentfulStatusCode);
}

/**
 * Two checks, answering different questions.
 *
 * The website role answers "may this person touch this site at all" — Core
 * owns that, and nothing above it does. The permission answers "has their team
 * narrowed what they may do", which only the gateway knows, because a custom
 * role is a team-level object Core has never heard of.
 *
 * `permission` is optional so a route that predates the team model keeps
 * working unchanged; passing one is what opts a route into being narrowable.
 */
export async function requireWebsiteAccess(
  c: WebsiteContext,
  deps: WebsiteControllerDeps,
  websiteId: string,
  minimum: WebsiteRole,
  permission?: Permission,
): Promise<{ userId: string; role: WebsiteRole } | { denied: Response }> {
  const userId = requireUser(c);
  if (!userId) return { denied: c.json({ error: "unauthorized" }, 401) };
  const role = await deps.websites.getRole(websiteId, userId);
  if (!role || !roleAtLeast(role, minimum)) {
    return { denied: c.json({ error: "forbidden" }, 403) };
  }
  if (permission) {
    const denied = permissionDenied(c, permission);
    if (denied) return { denied };
  }
  return { userId, role };
}
