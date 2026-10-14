import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { roleAtLeast, type WebsiteQuery } from "../websites/interfaces";
import type { LeadMutations, LeadQueries } from "./interfaces";
import { submissionsToCsv } from "./lib/submission-csv";
import { submissionListSchema } from "./validators/lead.schema";

export type LeadControllerDeps = {
  queries: LeadQueries;
  mutations: LeadMutations;
  websites: WebsiteQuery;
};

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
 * The dashboard side of the module. There is deliberately no site-wide inbox: submissions are
 * read per form, from that form's automation page.
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

  return routes;
}
