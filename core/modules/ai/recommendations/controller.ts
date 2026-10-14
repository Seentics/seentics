import type { Context } from "hono";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import type { WebsiteQuery } from "../../websites/interfaces";
import { roleAtLeast } from "../../websites/interfaces";
import type { RecommendationService, RecommendationView } from "./service";
import { isRecommendationStatus, type RecommendationStatus } from "./types";

type Deps = { recommendations: RecommendationService; websites: WebsiteQuery };
type C = Context<{ Variables: AuthVars }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The wire shape. Internal bookkeeping (dedupe key, who applied it, the query id) stays server-side. */
export function presentRecommendation(r: RecommendationView) {
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    rationale: r.rationale,
    prompt: r.prompt,
    target: r.target,
    metric: r.metric,
    status: r.status,
    appliedAt: r.appliedAt,
    appliedVia: r.appliedVia,
    resource: r.resource,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    report: r.report,
  };
}

/** Signed in, a valid website id, and a role on it; a write also needs member or above. */
async function access(c: C, deps: Deps, write: boolean): Promise<{ websiteId: string; userId: string } | Response> {
  const websiteId = c.req.param("website_id") ?? "";
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  if (!UUID.test(websiteId)) return c.json({ error: "invalid website id" }, 400);
  const role = await deps.websites.getRole(websiteId, userId);
  if (!role) return c.json({ error: "website not found or access denied" }, 403);
  if (write && !roleAtLeast(role, "member")) return c.json({ error: "forbidden" }, 403);
  return { websiteId, userId };
}

/** GET /recommendations/:website_id?status=open,measured — newest first, each with its impact report. */
export function listRecommendations(deps: Deps) {
  return async (c: C) => {
    const a = await access(c, deps, false);
    if (a instanceof Response) return a;
    const raw = (c.req.query("status") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const statuses = raw.filter(isRecommendationStatus) as RecommendationStatus[];
    if (raw.length && statuses.length !== raw.length) return c.json({ error: "unknown status" }, 400);
    const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), 100);
    const rows = await deps.recommendations.list(a.websiteId, { statuses: statuses.length ? statuses : undefined, limit });
    return c.json({ data: rows.map(presentRecommendation) });
  };
}

/** GET /recommendations/:website_id/:id — one recommendation and its impact report. */
export function getRecommendation(deps: Deps) {
  return async (c: C) => {
    const a = await access(c, deps, false);
    if (a instanceof Response) return a;
    const id = c.req.param("id") ?? "";
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    const row = await deps.recommendations.get(a.websiteId, id);
    return row ? c.json({ data: presentRecommendation(row) }) : c.json({ error: "not found" }, 404);
  };
}

/** POST /recommendations/:website_id/:id/dismiss — an open suggestion, put away. */
export function dismissRecommendation(deps: Deps) {
  return async (c: C) => {
    const a = await access(c, deps, true);
    if (a instanceof Response) return a;
    const id = c.req.param("id") ?? "";
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    const row = await deps.recommendations.dismiss(a.websiteId, id);
    return row
      ? c.json({ data: presentRecommendation(row) })
      : c.json({ error: "That suggestion is no longer open." }, 409);
  };
}

/** POST /recommendations/:website_id/:id/done — "I did this myself": applied, nothing created, measured. */
export function markRecommendationDone(deps: Deps) {
  return async (c: C) => {
    const a = await access(c, deps, true);
    if (a instanceof Response) return a;
    const id = c.req.param("id") ?? "";
    if (!UUID.test(id)) return c.json({ error: "not found" }, 404);
    const row = await deps.recommendations.markDone(a.websiteId, id, a.userId);
    return row
      ? c.json({ data: presentRecommendation(row) })
      : c.json({ error: "That suggestion is no longer open." }, 409);
  };
}
