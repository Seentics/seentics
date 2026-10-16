import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { takeRateToken } from "../../platform/cache/token-bucket";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { roleAtLeast, type WebsiteQuery } from "../websites/interfaces";
import { CONVERSION_PLATFORMS, type ConversionAdmin } from "./interfaces/conversions";

export type ConversionControllerDeps = { admin: ConversionAdmin; websites: WebsiteQuery };

/** Connecting and testing call the platform, so they are metered per website. */
const CALLS_PER_MINUTE = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const eventName = z.string().trim().min(1).max(120);
const configSchema = z.object({
  events: z.object({ purchase: eventName.nullable(), lead: eventName.nullable(), sign_up: eventName.nullable() }).partial().optional(),
  custom: z.array(z.object({ name: eventName, platform_event: eventName })).max(50).optional(),
  test_event_code: z.string().trim().max(60).nullable().optional(),
}).strict();
const credentialsSchema = z.record(z.string().max(1000)).refine((c) => Object.keys(c).length <= 4);
const createSchema = z.object({
  platform: z.enum(CONVERSION_PLATFORMS),
  name: z.string().trim().max(80).optional(),
  credentials: credentialsSchema,
  config: configSchema.optional(),
});
const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  credentials: credentialsSchema.optional(),
  config: configSchema.optional(),
}).strict();
const eventsQuery = z.object({
  destination: z.string().uuid().optional().transform((v) => v ?? null),
  status: z.enum(["pending", "success", "failed", "skipped"]).optional().transform((v) => v ?? null),
  kind: z.enum(["purchase", "lead", "sign_up", "custom"]).optional().transform((v) => v ?? null),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

async function requireAccess(c: Context<{ Variables: AuthVars }>, deps: ConversionControllerDeps, websiteId: string, write: boolean) {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const role = await deps.websites.getRole(websiteId, userId);
  if (!role || (write && !roleAtLeast(role, "member"))) return c.json({ error: "forbidden" }, 403);
  return null;
}

const rateLimited = (c: Context, websiteId: string) =>
  takeRateToken(`conversions:${websiteId}`, CALLS_PER_MINUTE, 60_000).allowed
    ? null
    : c.json({ error: "rate_limited", message: "Too many attempts. Try again in a minute." }, 429);

async function body(c: Context): Promise<unknown> {
  try { return await c.req.json(); } catch { return null; }
}

/** Server-side conversions: the destinations, their delivery log and summary. */
export function createConversionRoutes(deps: ConversionControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use(authMiddleware);

  routes.get("/:website_id/destinations", async (c) => {
    const w = c.req.param("website_id");
    const denied = await requireAccess(c, deps, w, false);
    if (denied) return denied;
    return c.json({ data: await deps.admin.list(w) });
  });

  routes.post("/:website_id/destinations", async (c) => {
    const w = c.req.param("website_id");
    const denied = (await requireAccess(c, deps, w, true)) ?? rateLimited(c, w);
    if (denied) return denied;
    const parsed = createSchema.safeParse(await body(c));
    if (!parsed.success) return c.json({ error: "invalid", message: parsed.error.issues[0]?.message ?? "Check the values" }, 400);
    const result = await deps.admin.create(w, parsed.data as Parameters<ConversionAdmin["create"]>[1]);
    if ("error" in result) {
      return result.error === "exists"
        ? c.json({ error: "exists", message: "This is already connected." }, 409)
        : c.json({ error: "invalid_credentials", message: result.message }, 400);
    }
    return c.json({ data: result.destination }, 201);
  });

  routes.patch("/:website_id/destinations/:id", async (c) => {
    const w = c.req.param("website_id");
    const id = c.req.param("id");
    const denied = (await requireAccess(c, deps, w, true)) ?? null;
    if (denied) return denied;
    if (!UUID.test(id)) return c.json({ error: "not_found" }, 404);
    const parsed = patchSchema.safeParse(await body(c));
    if (!parsed.success) return c.json({ error: "invalid", message: parsed.error.issues[0]?.message ?? "Check the values" }, 400);
    if (parsed.data.credentials) {
      const limited = rateLimited(c, w);
      if (limited) return limited;
    }
    const result = await deps.admin.update(w, id, parsed.data as Parameters<ConversionAdmin["update"]>[2]);
    if ("error" in result) {
      return result.error === "not_found" ? c.json({ error: "not_found" }, 404) : c.json({ error: "invalid_credentials", message: result.message }, 400);
    }
    return c.json({ data: result.destination });
  });

  routes.delete("/:website_id/destinations/:id", async (c) => {
    const w = c.req.param("website_id");
    const id = c.req.param("id");
    const denied = await requireAccess(c, deps, w, true);
    if (denied) return denied;
    if (!UUID.test(id)) return c.json({ error: "not_found" }, 404);
    return (await deps.admin.remove(w, id)) ? c.json({ data: { id } }) : c.json({ error: "not_found" }, 404);
  });

  routes.post("/:website_id/destinations/:id/test", async (c) => {
    const w = c.req.param("website_id");
    const id = c.req.param("id");
    const denied = (await requireAccess(c, deps, w, true)) ?? rateLimited(c, w);
    if (denied) return denied;
    if (!UUID.test(id)) return c.json({ error: "not_found" }, 404);
    const b = (await body(c)) as { test_event_code?: unknown } | null;
    const code = typeof b?.test_event_code === "string" ? b.test_event_code.slice(0, 60) : null;
    const result = await deps.admin.test(w, id, code);
    return result ? c.json({ data: result }) : c.json({ error: "not_found" }, 404);
  });

  routes.get("/:website_id/events", async (c) => {
    const w = c.req.param("website_id");
    const denied = await requireAccess(c, deps, w, false);
    if (denied) return denied;
    const q = eventsQuery.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return c.json({ data: await deps.admin.events(w, q.data) });
  });

  routes.post("/:website_id/events/:id/retry", async (c) => {
    const w = c.req.param("website_id");
    const id = c.req.param("id");
    const denied = await requireAccess(c, deps, w, true);
    if (denied) return denied;
    if (!UUID.test(id)) return c.json({ error: "not_found" }, 404);
    return (await deps.admin.retry(w, id)) ? c.json({ data: { id } }) : c.json({ error: "not_found" }, 404);
  });

  routes.get("/:website_id/summary", async (c) => {
    const w = c.req.param("website_id");
    const denied = await requireAccess(c, deps, w, false);
    if (denied) return denied;
    const days = Math.min(90, Math.max(1, Number(c.req.query("days")) || 30));
    return c.json({ data: await deps.admin.summary(w, days) });
  });

  return routes;
}
