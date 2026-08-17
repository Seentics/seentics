import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { parseJson, validationErrorResponse } from "../../platform/validation";
import type { WebsiteQuery } from "../websites/interfaces";
import type {
  AutomationCrud,
  AutomationInsights,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "./interfaces";
// Imported from the schema module rather than a barrel: `automationsUpsertBodySchema`
// is a `.passthrough()` schema whose inferred output widens when re-exported.
import {
  automationsBulkDeleteSchema,
  automationsUpsertBodySchema,
} from "./validators/automation.schema";

/**
 * HTTP surface for automations, mounted at `/api/v1/automations`.
 *
 * A factory rather than a module-level singleton router, so dependencies arrive at
 * composition time instead of being reached for through imports — which is what
 * lets these routes run against a stubbed service.
 *
 * Every response shape here is already consumed by the dashboard: the list is
 * snake_case with embedded stats, the single-automation endpoints return the
 * camelCase row, and both are wrapped in `{ data }`. Preserved exactly.
 */
export function createAutomationRoutes(deps: {
  automations: AutomationCrud & AutomationInsights;
  websites: WebsiteQuery;
}) {
  const { automations, websites } = deps;
  const r = new Hono<{ Variables: AuthVars }>();

  r.use("*", authMiddleware);

  /**
   * Authenticate and confirm the caller may act on this website's automations.
   *
   * Returns a `Response` to short-circuit with, or `null` to proceed. Answers 403
   * for an unknown website as well as a forbidden one, so the endpoint cannot be
   * used to probe which site ids exist — the same reason the service raises a
   * "forbidden" rather than a "not found" when a reference will not resolve.
   *
   * One role lookup per request replaces the per-service-call `assertWebsiteAccess`
   * these handlers used to trigger indirectly, and it runs on the write routes as
   * well as the reads: an automation definition holds webhook URLs and headers.
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

  // GET /:website_id — every automation for the website, with its counters.
  r.get("/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    return c.json({ data: await automations.list(websiteRef) });
  });

  /**
   * POST /:website_id — create.
   *
   * The body schema is `.passthrough()` with every field optional: it exists to
   * validate the webhook actions (URL allow-list, forbidden headers), not to
   * guarantee a complete automation. That is why the parsed body is cast rather
   * than matching `CreateAutomationInput` structurally — tightening it here would
   * start rejecting request shapes the builder sends today.
   *
   * Parsed inline rather than with `parseJson` because that helper answers
   * malformed JSON with its own message; this endpoint has always returned the
   * schema's issue list for a null body.
   */
  r.post("/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const userId = requireUser(c)!;
    const raw = await c.req.json().catch(() => null);
    const ok = automationsUpsertBodySchema.safeParse(raw);
    if (!ok.success) return validationErrorResponse(c, ok.error);

    const row = await automations.create(
      websiteRef,
      userId,
      ok.data as unknown as CreateAutomationInput,
    );
    return c.json({ data: row }, 201);
  });

  /**
   * DELETE /:website_id/bulk-delete
   *
   * Registered before `/:website_id/:id` so `bulk-delete` is not captured as an
   * automation id. Hono matches in registration order, so this ordering is
   * load-bearing rather than stylistic.
   */
  r.delete("/:website_id/bulk-delete", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const parsed = await parseJson(c, automationsBulkDeleteSchema);
    if (!parsed.ok) return parsed.res;

    await automations.bulkDelete(websiteRef, parsed.data.ids ?? []);
    return c.body(null, 204);
  });

  // GET /:website_id/:id — one automation.
  r.get("/:website_id/:id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const row = await automations.get(websiteRef, c.req.param("id"));
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json({ data: row });
  });

  // PUT /:website_id/:id — update. Same body schema as create; see the note there.
  r.put("/:website_id/:id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const raw = await c.req.json().catch(() => null);
    const ok = automationsUpsertBodySchema.safeParse(raw);
    if (!ok.success) return validationErrorResponse(c, ok.error);

    const row = await automations.update(
      websiteRef,
      c.req.param("id"),
      ok.data as unknown as UpdateAutomationInput,
    );
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json({ data: row });
  });

  // DELETE /:website_id/:id — 204 whether or not there was anything to delete.
  r.delete("/:website_id/:id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    await automations.remove(websiteRef, c.req.param("id"));
    return c.body(null, 204);
  });

  // GET /:website_id/:id/executions — the run log, newest first.
  r.get("/:website_id/:id/executions", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const rows = await automations.executions(websiteRef, c.req.param("id"));
    if (!rows) return c.json({ error: "not found" }, 404);
    return c.json({ data: rows });
  });

  // POST /:website_id/:id/toggle — flip is_active.
  r.post("/:website_id/:id/toggle", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const row = await automations.toggle(websiteRef, c.req.param("id"));
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json({ data: row });
  });

  // GET /:website_id/:id/stats — lifetime counters.
  r.get("/:website_id/:id/stats", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const stats = await automations.stats(websiteRef, c.req.param("id"));
    if (!stats) return c.json({ error: "not found" }, 404);
    return c.json({ data: stats });
  });

  // GET /:website_id/:id/stats/daily — 14 buckets for the sparkline.
  r.get("/:website_id/:id/stats/daily", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const daily = await automations.dailyStats(websiteRef, c.req.param("id"));
    if (!daily) return c.json({ error: "not found" }, 404);
    return c.json({ data: daily });
  });

  return r;
}
