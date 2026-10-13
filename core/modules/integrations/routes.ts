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
  invalid: 400, rejected: 422, unavailable: 502, not_found: 404, no_key: 503,
};

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
    return c.json({ data: { providers: await deps.queries.list(websiteId) } });
  });

  routes.get("/:website_id/deliveries", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const q = deliveriesQuerySchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return c.json({ data: { deliveries: await deps.queries.deliveries(websiteId, q.data.limit) } });
  });

  routes.put("/:website_id/:provider", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const body = connectSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid", message: "Credentials are required." }, 400);
    const limited = rateLimited(c, websiteId);
    if (limited) return limited;

    const result = await deps.mutations.connect(websiteId, c.req.param("provider"), body.data);
    return result.ok ? c.json({ data: result.value }) : failure(c, result);
  });

  routes.patch("/:website_id/:provider", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const body = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid", message: "Nothing to update." }, 400);
    if (body.data.config !== undefined || body.data.credentials !== undefined) {
      const limited = rateLimited(c, websiteId);
      if (limited) return limited;
    }

    const result = await deps.mutations.update(websiteId, c.req.param("provider"), body.data);
    return result.ok ? c.json({ data: result.value }) : failure(c, result);
  });

  routes.delete("/:website_id/:provider", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    return (await deps.mutations.disconnect(websiteId, c.req.param("provider")))
      ? c.json({ data: { provider: c.req.param("provider") } })
      : c.json({ error: "not_found", message: "This integration is not connected." }, 404);
  });

  routes.post("/:website_id/:provider/test", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const limited = rateLimited(c, websiteId);
    if (limited) return limited;

    const result = await deps.mutations.sendTest(websiteId, c.req.param("provider"));
    return result.ok ? c.json({ data: result.value }) : failure(c, result);
  });

  return routes;
}
