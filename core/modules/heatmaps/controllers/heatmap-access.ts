import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { roleAtLeast, type WebsiteRole } from "../../websites/interfaces";
import type { HeatmapControllerDeps } from "./heatmap-controller.types";

/**
 * Any member of the site reads; capturing, uploading or deleting needs `minimum` — "member" (a
 * capture runs a browser on our side; a delete cannot be undone). A viewer only looks.
 */
export async function requireHeatmapAccess(
  c: Context<{ Variables: AuthVars }>,
  deps: HeatmapControllerDeps,
  websiteRef: string,
  minimum: WebsiteRole = "viewer",
): Promise<Response | null> {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "forbidden" }, 403);
  const role = await deps.websites.getRole(websiteRef, userId);
  if (!role || !roleAtLeast(role, minimum)) {
    return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);
  }
  return null;
}
