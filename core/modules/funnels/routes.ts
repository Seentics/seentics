import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { log } from "../../platform/lib/logger";
import { parseJson, parseQuery, validationErrorResponse } from "../../platform/validation";
import type { WebsiteQuery } from "../websites/interfaces";
import type {
  CreateFunnelInput,
  FunnelMutations,
  FunnelPerformance,
  FunnelQuery,
  FunnelTrackerConfig,
  UpdateFunnelInput,
} from "./interfaces";
// Imported from the schema module rather than the `./validators` barrel: the bulk
// delete schema carries a `.default([])`, whose inferred output widens when it passes
// through a re-export and silently costs the handler its parameter types.
import {
  funnelsActiveQuerySchema,
  funnelsBulkDeleteSchema,
  funnelsUpsertBodySchema,
} from "./validators/funnel.schema";

const funnel_log = log.child({ category: "funnels" });

/**
 * HTTP surface for funnels.
 *
 * Returns two routers because they are mounted at different base paths and have
 * different audiences: the public one is the unauthenticated tracker endpoint under
 * `/api/v1/funnels`, the authenticated one hangs off `/api/v1/websites` so its paths
 * read `/:website_id/funnels/...`. Merging them would either put auth on the tracker
 * endpoint or take it off the CRUD.
 */
export function createFunnelRoutes(deps: {
  funnels: FunnelQuery & FunnelMutations & FunnelPerformance & FunnelTrackerConfig;
  websites: WebsiteQuery;
}) {
  const { funnels, websites } = deps;

  // ─── Public: tracker funnel definitions ──────────────────────────────────
  const publicRoutes = new Hono<{ Variables: AuthVars }>();

  /**
   * GET /active?website_id=…
   *
   * Deliberately unauthenticated — it is read by the tracker snippet on pages we do
   * not control. It exposes only active funnel definitions, which are already
   * shipped to every visitor's browser by `/tracker/init`.
   */
  publicRoutes.get("/active", async (c) => {
    const q = parseQuery(c, funnelsActiveQuerySchema);
    if (!q.ok) return q.res;
    const websiteRef = q.data.website_id ?? q.data.websiteId;
    // Answered here rather than by a schema refinement so the body stays the flat
    // `{ error }` the tracker checks for, not a field-error map.
    if (!websiteRef) return c.json({ error: "website_id required" }, 400);

    return c.json({ data: await funnels.activeForWebsiteRef(websiteRef) });
  });

  // ─── Authenticated: funnel CRUD and reporting ────────────────────────────
  const authRoutes = new Hono<{ Variables: AuthVars }>();
  authRoutes.use("*", authMiddleware);

  /**
   * Authenticate and confirm the caller may act on this website's funnels.
   *
   * Returns a `Response` to short-circuit with, or `null` to proceed — the shape
   * that keeps each handler to a few lines instead of a nested try/catch.
   *
   * Answers 403 for a website that does not exist as well as one the caller cannot
   * see, so the endpoint cannot be used to enumerate which site ids are real. The
   * previous version got the same result by accident, by catching every throw from
   * `assertWebsiteAccess` — including "website not found" — and mapping it to 403.
   *
   * Read and write are guarded identically: funnel definitions reveal a site's
   * checkout and signup paths, so listing them is not a lesser privilege than
   * editing them.
   */
  async function denyUnlessPermitted(
    c: Context<{ Variables: AuthVars }>,
    websiteRef: string,
  ): Promise<Response | null> {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const role = await websites.getRole(websiteRef, userId);
    if (!role) return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);

    return null;
  }

  /** Unexpected failure below the guard. Logged with detail, answered generically. */
  function fail(c: Context, op: string, websiteRef: string, e: unknown): Response {
    funnel_log.error({
      msg: "funnel_request_failed",
      op,
      website_id: websiteRef,
      err: e instanceof Error ? e.message : String(e),
    });
    return c.json({ error: "Failed to process funnel request" }, 500);
  }

  // GET /:website_id/funnels — funnel definitions, newest first.
  authRoutes.get("/:website_id/funnels", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    try {
      return c.json({ data: await funnels.list(websiteRef) });
    } catch (e) {
      return fail(c, "list", websiteRef, e);
    }
  });

  authRoutes.post("/:website_id/funnels", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const userId = requireUser(c)!;
    const raw = await c.req.json().catch(() => null);
    const ok = funnelsUpsertBodySchema.safeParse(raw);
    if (!ok.success) return validationErrorResponse(c, ok.error);

    try {
      // Cast rather than parsed: `funnelsUpsertBodySchema` is deliberately an open
      // record, so the builder's evolving `steps` shapes reach the repository's
      // normalizer intact. See the schema for why tightening it breaks old clients.
      const created = await funnels.create(websiteRef, userId, ok.data as CreateFunnelInput);
      return c.json({ data: created }, 201);
    } catch (e) {
      return fail(c, "create", websiteRef, e);
    }
  });

  /**
   * DELETE /:website_id/funnels/bulk-delete
   *
   * Registered before `/:website_id/funnels/:funnel_id` so `bulk-delete` is not
   * captured as a funnel id. Hono matches in registration order, so this ordering is
   * load-bearing rather than stylistic.
   */
  authRoutes.delete("/:website_id/funnels/bulk-delete", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const parsed = await parseJson(c, funnelsBulkDeleteSchema);
    if (!parsed.ok) return parsed.res;

    try {
      await funnels.bulkRemove(websiteRef, parsed.data.ids);
      return c.body(null, 204);
    } catch (e) {
      return fail(c, "bulk_delete", websiteRef, e);
    }
  });

  authRoutes.get("/:website_id/funnels/:funnel_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    try {
      const funnel = await funnels.get(websiteRef, c.req.param("funnel_id"));
      if (!funnel) return c.json({ error: "not found" }, 404);
      return c.json({ data: funnel });
    } catch (e) {
      return fail(c, "get", websiteRef, e);
    }
  });

  authRoutes.put("/:website_id/funnels/:funnel_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const raw = await c.req.json().catch(() => null);
    const ok = funnelsUpsertBodySchema.safeParse(raw);
    if (!ok.success) return validationErrorResponse(c, ok.error);

    try {
      const updated = await funnels.update(
        websiteRef,
        c.req.param("funnel_id"),
        ok.data as UpdateFunnelInput,
      );
      if (!updated) return c.json({ error: "not found" }, 404);
      return c.json({ data: updated });
    } catch (e) {
      return fail(c, "update", websiteRef, e);
    }
  });

  authRoutes.delete("/:website_id/funnels/:funnel_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    try {
      await funnels.remove(websiteRef, c.req.param("funnel_id"));
      return c.body(null, 204);
    } catch (e) {
      return fail(c, "remove", websiteRef, e);
    }
  });

  // GET /:website_id/funnels/:funnel_id/stats — conversion report over `days`.
  authRoutes.get("/:website_id/funnels/:funnel_id/stats", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    // Left as a possibly-NaN number rather than validated: the service clamps it,
    // and a stale bookmark should render the default window, not a 400.
    const daysParam = c.req.query("days");
    const days = daysParam === undefined ? undefined : Number(daysParam);

    try {
      const report = await funnels.report(websiteRef, c.req.param("funnel_id"), days);
      if (!report) return c.json({ error: "not found" }, 404);
      return c.json({ data: report });
    } catch (e) {
      return fail(c, "report", websiteRef, e);
    }
  });

  return { publicRoutes, authRoutes };
}
