import type { Context } from "hono";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import type { WebsiteQuery } from "../../websites/interfaces";
import { roleAtLeast } from "../../websites/interfaces";
import type { InsightService } from "./service";
import { EVIDENCE_PATH } from "./types";

type Deps = { insights: InsightService; websites: WebsiteQuery };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the dashboard reads: the newest insight, with each line's evidence as a dashboard path suffix. */
function present(insight: Awaited<ReturnType<InsightService["latest"]>>) {
  if (!insight) return null;
  return {
    date: insight.insightDate,
    status: insight.status,
    source: insight.source,
    reason: insight.reason,
    createdAt: insight.createdAt,
    lines: insight.lines.map((l) => ({
      kind: l.kind,
      text: l.text,
      evidence: { kind: l.evidence.kind, label: l.evidence.label, path: EVIDENCE_PATH[l.evidence.kind] },
      action: l.action ?? null,
    })),
  };
}

/** GET /insights/:website_id — the stored insight. Reading never calls a model, so it costs nothing. */
export function getInsight(deps: Deps) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const websiteId = c.req.param("website_id") ?? "";
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    if (!UUID.test(websiteId)) return c.json({ error: "invalid website id" }, 400);
    if (!(await deps.websites.getRole(websiteId, userId))) return c.json({ error: "website not found or access denied" }, 403);
    return c.json({ data: present(await deps.insights.latest(websiteId)) });
  };
}

/**
 * POST /insights/:website_id/refresh — generate today's insight now.
 *
 * For an owner who has just fixed something, or whose site was too small this morning. Limited to
 * once every six hours per site and to members, since each one can cost a model call.
 */
export function refreshInsight(deps: Deps) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const websiteId = c.req.param("website_id") ?? "";
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    if (!UUID.test(websiteId)) return c.json({ error: "invalid website id" }, 400);
    const role = await deps.websites.getRole(websiteId, userId);
    if (!role) return c.json({ error: "website not found or access denied" }, 403);
    if (!roleAtLeast(role, "member")) return c.json({ error: "forbidden" }, 403);

    try {
      const result = await deps.insights.generate(websiteId, { force: true });
      const retryAfterSec = result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000) : undefined;
      if (retryAfterSec) c.header("Retry-After", String(retryAfterSec));
      return c.json({ data: present(result.insight), refreshed: result.generated, retryAfterSec: retryAfterSec ?? null });
    } catch {
      return c.json({ error: "Insights could not be generated right now." }, 503);
    }
  };
}
