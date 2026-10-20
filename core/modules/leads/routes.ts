import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { roleAtLeast, type WebsiteQuery } from "../websites/interfaces";
import type { ContactMutations, LeadMutations, LeadQueries, SiteLeadQueries } from "./interfaces";
import { submissionsToCsv } from "./lib/submission-csv";
import { contactsToCsv, siteSubmissionsToCsv } from "./lib/contact-csv";
import {
  contactBulkSchema,
  contactCreateSchema,
  contactDeleteSchema,
  contactImportSchema,
  contactListSchema,
  contactPatchSchema,
  leadsOverviewSchema,
  siteSubmissionListSchema,
  submissionListSchema,
} from "./validators/lead.schema";

export type LeadControllerDeps = {
  queries: LeadQueries;
  mutations: LeadMutations;
  site: SiteLeadQueries;
  contacts: ContactMutations;
  websites: WebsiteQuery;
};

const csv = (body: string, filename: string) =>
  new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });

/** A JSON body, or null when it is missing or not JSON. */
async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

export const EXPORT_LIMIT = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Membership check, run before every handler. Viewers may read; erasing a submission needs at least `member`. */
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

/**
 * The dashboard side of the module: each form's submissions (on its automation page), the
 * site-wide inbox of every form's submissions, and the contacts behind them.
 */
export function createLeadRoutes(deps: LeadControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use(authMiddleware);

  routes.get("/:website_id/summary", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    return c.json({ data: await deps.queries.websiteSummary(websiteId) });
  });

  // The leads page's numbers over a window: what came in, from where, and what failed to send.
  routes.get("/:website_id/overview", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const q = leadsOverviewSchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return c.json({ data: await deps.site.overview(websiteId, q.data.days) });
  });

  routes.get("/:website_id/forms/:automation_id/summary", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const automationId = c.req.param("automation_id");
    if (!UUID.test(automationId)) return c.json({ error: "not found" }, 404);
    return c.json({ data: await deps.queries.summary(websiteId, automationId) });
  });

  routes.get("/:website_id/forms/:automation_id/submissions.csv", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const automationId = c.req.param("automation_id");
    if (!UUID.test(automationId)) return c.json({ error: "not found" }, 404);

    const rows = await deps.queries.exportSubmissions(websiteId, automationId, EXPORT_LIMIT);
    return new Response(submissionsToCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="submissions.csv"',
        "cache-control": "no-store",
      },
    });
  });

  routes.get("/:website_id/forms/:automation_id/submissions", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const automationId = c.req.param("automation_id");
    if (!UUID.test(automationId)) return c.json({ error: "not found" }, 404);

    const q = submissionListSchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return c.json({ data: await deps.queries.listSubmissions(websiteId, automationId, q.data) });
  });

  routes.delete("/:website_id/forms/:automation_id/submissions/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const automationId = c.req.param("automation_id");
    const id = c.req.param("id");
    if (!UUID.test(automationId) || !UUID.test(id)) return c.json({ error: "not found" }, 404);
    return (await deps.mutations.deleteSubmission(websiteId, automationId, id))
      ? c.json({ data: { id } })
      : c.json({ error: "not found" }, 404);
  });

  // --- The site-wide inbox --------------------------------------------------

  routes.get("/:website_id/submissions.csv", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const q = siteSubmissionListSchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return csv(siteSubmissionsToCsv(await deps.site.exportSubmissions(websiteId, q.data, EXPORT_LIMIT)), "submissions.csv");
  });

  routes.get("/:website_id/submissions", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const q = siteSubmissionListSchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return c.json({ data: await deps.site.listSubmissions(websiteId, q.data) });
  });

  routes.delete("/:website_id/submissions/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const id = c.req.param("id");
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    return (await deps.contacts.deleteSubmission(websiteId, id)) ? c.json({ data: { id } }) : c.json({ error: "not found" }, 404);
  });

  routes.get("/:website_id/forms", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    return c.json({ data: await deps.site.forms(websiteId) });
  });

  // --- Contacts --------------------------------------------------------------

  routes.get("/:website_id/contacts.csv", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const q = contactListSchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return csv(contactsToCsv(await deps.site.exportContacts(websiteId, q.data, EXPORT_LIMIT)), "contacts.csv");
  });

  routes.get("/:website_id/contacts", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const q = contactListSchema.safeParse(c.req.query());
    if (!q.success) return c.json({ error: "invalid query" }, 400);
    return c.json({ data: await deps.site.listContacts(websiteId, q.data) });
  });

  routes.post("/:website_id/contacts", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const body = contactCreateSchema.safeParse(await jsonBody(c));
    if (!body.success) return c.json({ error: "invalid contact", issues: body.error.issues.map((i) => i.path.join(".")) }, 400);
    const result = await deps.contacts.create(websiteId, body.data);
    if ("exists" in result) return c.json({ error: "exists", contact_id: result.exists }, 409);
    return c.json({ data: result.contact }, 201);
  });

  routes.post("/:website_id/contacts/bulk", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const body = contactBulkSchema.safeParse(await jsonBody(c));
    if (!body.success) return c.json({ error: "invalid change" }, 400);
    const { ids, ...change } = body.data;
    return c.json({ data: { updated: await deps.contacts.bulk(websiteId, ids, change) } });
  });

  routes.post("/:website_id/contacts/delete", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const body = contactDeleteSchema.safeParse(await jsonBody(c));
    if (!body.success) return c.json({ error: "invalid request" }, 400);
    return c.json({ data: { deleted: await deps.contacts.remove(websiteId, body.data.ids, body.data.with_submissions) } });
  });

  routes.post("/:website_id/contacts/import", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const body = contactImportSchema.safeParse(await jsonBody(c));
    if (!body.success) return c.json({ error: "invalid import" }, 400);
    return c.json({ data: await deps.contacts.import(websiteId, body.data.rows, body.data.update_existing) });
  });

  // Before `/contacts/:id`, which would otherwise take "tags" for an id.
  routes.get("/:website_id/contacts/tags", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    return c.json({ data: await deps.site.tags(websiteId) });
  });

  routes.get("/:website_id/contacts/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: false });
    if (denied) return denied;
    const id = c.req.param("id");
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    const found = await deps.site.contact(websiteId, id);
    return found ? c.json({ data: found }) : c.json({ error: "not found" }, 404);
  });

  routes.patch("/:website_id/contacts/:id", async (c) => {
    const websiteId = c.req.param("website_id");
    const denied = await requireLeadAccess(c, deps, websiteId, { write: true });
    if (denied) return denied;
    const id = c.req.param("id");
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    const body = contactPatchSchema.safeParse(await jsonBody(c));
    if (!body.success) return c.json({ error: "invalid change" }, 400);
    const updated = await deps.contacts.update(websiteId, id, body.data);
    return updated ? c.json({ data: updated }) : c.json({ error: "not found" }, 404);
  });

  return routes;
}
