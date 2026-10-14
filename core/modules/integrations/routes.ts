import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { takeRateToken } from "../../platform/cache/token-bucket";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { roleAtLeast, type WebsiteQuery } from "../websites/interfaces";
import type { IntegrationFailure, IntegrationMutations, IntegrationQueries } from "./interfaces";
import { connectSchema, deliveriesQuerySchema, updateSchema } from "./validators/integration.schema";

export type IntegrationControllerDeps = {
  queries: IntegrationQueries;
  mutations: IntegrationMutations;
  websites: WebsiteQuery;
};

/** Connecting and testing call a third party, so they are metered per website. */
const CALLS_PER_MINUTE = 10;

const STATUS: Record<IntegrationFailure["code"], ContentfulStatusCode> = {
  invalid: 400, rejected: 422, unavailable: 502, not_found: 404, no_key: 503, connection_limit: 409,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = (c: Context) => c.json({ error: "not_found", message: "This destination does not exist." }, 404);

/** Viewers may read; connecting, changing and testing need at least `member`. */
async function requireAccess(
  c: Context<{ Variables: AuthVars }>,
  deps: IntegrationControllerDeps,
  websiteId: string,
  { write }: { write: boolean },
): Promise<Response | null> {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const role = await deps.websites.getRole(websiteId, userId);
  if (!role || (write && !roleAtLeast(role, "member"))) return c.json({ error: "forbidden" }, 403);
  return null;
}

const rateLimited = (c: Context, websiteId: string) =>
  takeRateToken(`integrations:${websiteId}`, CALLS_PER_MINUTE, 60_000).allowed
    ? null
    : c.json({ error: "rate_limited", message: "Too many attempts. Try again in a minute." }, 429);

function failure(c: Context, f: IntegrationFailure) {
  return c.json({ error: f.code, message: f.message }, STATUS[f.code]);
}

export function createIntegrationRoutes(deps: IntegrationControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use(authMiddleware);

  routes.get("/:website_id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    return c.json({ data: await deps.queries.list(websiteId) });
  });

  routes.get("/:website_id/deliveries", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const q = deliveriesQuerySchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    const { limit, status, connection_id: connectionId } = q.data;
    return c.json({ data: { deliveries: await deps.queries.deliveries(websiteId, { limit, status, connectionId }) } });
  });

  routes.post("/:website_id/deliveries/:id/retry", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const id = c.req.param("id");
    if (!UUID.test(id)) return c.json({ error: "not_found", message: "This delivery can no longer be retried." }, 404);

    const result = await deps.mutations.retryDelivery(websiteId, id);
    return result.ok ? c.json({ data: result.value }) : failure(c, result);
  });

  routes.post("/:website_id/connections", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const body = connectSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid", message: "Choose a destination and fill in its details." }, 400);
    const limited = rateLimited(c, websiteId);
    if (limited) return limited;

    const result = await deps.mutations.connect(websiteId, body.data);
    return result.ok ? c.json({ data: result.value }, 201) : failure(c, result);
  });

  routes.patch("/:website_id/connections/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const id = c.req.param("id");
    if (!UUID.test(id)) return notFound(c);
    const body = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid", message: "Nothing to update." }, 400);
    if (body.data.config !== undefined || body.data.credentials !== undefined) {
      const limited = rateLimited(c, websiteId);
      if (limited) return limited;
    }

    const result = await deps.mutations.update(websiteId, id, body.data);
    return result.ok ? c.json({ data: result.value }) : failure(c, result);
  });

  routes.delete("/:website_id/connections/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const id = c.req.param("id");
    if (!UUID.test(id)) return notFound(c);
    return (await deps.mutations.disconnect(websiteId, id)) ? c.json({ data: { id } }) : notFound(c);
  });

  routes.post("/:website_id/connections/:id/test", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const id = c.req.param("id");
    if (!UUID.test(id)) return notFound(c);
    const limited = rateLimited(c, websiteId);
    if (limited) return limited;

    const result = await deps.mutations.sendTest(websiteId, id);
    return result.ok ? c.json({ data: result.value }) : failure(c, result);
  });

  return routes;
}
