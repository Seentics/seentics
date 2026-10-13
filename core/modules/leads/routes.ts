import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { roleAtLeast, type WebsiteQuery } from "../websites/interfaces";
import type { LeadMutations, LeadQueries } from "./interfaces";
import { csvCell } from "./lib/sanitize";
import { contactListSchema, contactStatusSchema } from "./validators/lead.schema";

export type LeadControllerDeps = {
  queries: LeadQueries;
  mutations: LeadMutations;
  websites: WebsiteQuery;
};

const EXPORT_LIMIT = 50_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Membership check, run before every handler. Viewers may read; changing or erasing contacts needs at least `member`. */
async function requireLeadAccess(
  c: Context<{ Variables: AuthVars }>,
  deps: LeadControllerDeps,
  websiteRef: string,
  { write }: { write: boolean },
): Promise<Response | null> {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const role = await deps.websites.getRole(websiteRef, userId);
  if (!role || (write && !roleAtLeast(role, "member"))) {
    return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);
  }
  return null;
}

export function createLeadRoutes(deps: LeadControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use(authMiddleware);

  routes.get("/:website_id/stats", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    return c.json({ data: await deps.queries.stats(websiteId) });
  });

  routes.get("/:website_id/export", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;

    const contacts = await deps.queries.exportContacts(websiteId, EXPORT_LIMIT);
    const header = ["email", "name", "phone", "status", "consent", "submissions", "first_submitted_at", "last_submitted_at"];
    const lines = [header.join(",")];
    for (const k of contacts) {
      lines.push(
        [k.email, k.name, k.phone, k.status, k.consent, k.submission_count, k.first_submitted_at, k.last_submitted_at]
          .map(csvCell)
          .join(","),
      );
    }
    return new Response(lines.join("\r\n") + "\r\n", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="contacts.csv"',
        "cache-control": "no-store",
      },
    });
  });

  routes.get("/:website_id/contacts", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;

    const q = contactListSchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return c.json({ data: await deps.queries.listContacts(websiteId, q.data) });
  });

  routes.get("/:website_id/contacts/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;

    const id = c.req.param("id");
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    const found = await deps.queries.getContact(websiteId, id);
    return found ? c.json({ data: found }) : c.json({ error: "not found" }, 404);
  });

  routes.patch("/:website_id/contacts/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;

    const id = c.req.param("id");
    const body = contactStatusSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid status" }, 400);
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    return (await deps.mutations.setStatus(websiteId, id, body.data.status))
      ? c.json({ data: { id, status: body.data.status } })
      : c.json({ error: "not found" }, 404);
  });

  routes.delete("/:website_id/contacts/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;

    const id = c.req.param("id");
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    return (await deps.mutations.deleteContact(websiteId, id))
      ? c.json({ data: { id } })
      : c.json({ error: "not found" }, 404);
  });

  return routes;
}
