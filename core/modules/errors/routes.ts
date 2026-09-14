import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import type { WebsiteQuery } from "../websites/interfaces";
import type { ErrorMutations, ErrorQueries } from "./interfaces";
import { isErrorStatus } from "./lib/status";

export type ErrorControllerDeps = {
  queries: ErrorQueries;
  mutations: ErrorMutations;
  websites: WebsiteQuery;
};

/**
 * Membership check, run before every handler.
 *
 * Same shape as `requireHeatmapAccess`. It is repeated per module rather than shared
 * because each one resolves the website through its own port, and a single helper would
 * need every module's deps to look alike.
 */
async function requireErrorAccess(
  c: Context<{ Variables: AuthVars }>,
  deps: ErrorControllerDeps,
  websiteRef: string,
): Promise<Response | null> {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "forbidden" }, 403);
  if (!(await deps.websites.getRole(websiteRef, userId))) {
    return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);
  }
  return null;
}

function daysParam(c: Context): number {
  const raw = Number(c.req.query("days"));
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 7;
}

export function createErrorRoutes(deps: ErrorControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use(authMiddleware);

  routes.get("/:website_id/groups", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await requireErrorAccess(c, deps, websiteRef);
    if (denied) return denied;

    const status = (c.req.query("status") ?? "").trim();
    // An unrecognised status would otherwise match nothing and read as "no errors",
    // which is the most misleading possible answer from this endpoint.
    if (status && !isErrorStatus(status)) {
      return c.json({ error: "unknown status" }, 400);
    }

    return c.json(
      await deps.queries.listGroups(websiteRef, {
        days: daysParam(c),
        status,
        search: c.req.query("search") ?? "",
        limit: Number(c.req.query("limit")) || undefined,
      }),
    );
  });

  routes.get("/:website_id/groups/:fingerprint", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await requireErrorAccess(c, deps, websiteRef);
    if (denied) return denied;

    const result = await deps.queries.getGroup(websiteRef, c.req.param("fingerprint"), {
      days: daysParam(c),
      limit: Number(c.req.query("limit")) || undefined,
    });
    if (!result.group) return c.json({ error: "not found" }, 404);
    return c.json(result);
  });

  routes.patch("/:website_id/groups/:fingerprint", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await requireErrorAccess(c, deps, websiteRef);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid request body" }, 400);
    }

    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!isErrorStatus(status)) return c.json({ error: "unknown status" }, 400);

    const updated = await deps.mutations.setStatus(websiteRef, c.req.param("fingerprint"), status);
    if (!updated) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true, status });
  });

  return routes;
}
