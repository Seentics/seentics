import type { Context } from "hono";
import { z } from "zod";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import type { WebsiteQuery } from "../../websites/interfaces";
import { roleAtLeast } from "../../websites/interfaces";
import type { AnomalyService } from "./service";
import { SENSITIVITIES } from "./types";

type Deps = { alerts: AnomalyService; websites: WebsiteQuery };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const settingsBody = z
  .object({ enabled: z.boolean().optional(), sensitivity: z.enum(SENSITIVITIES).optional() })
  .strict()
  .refine((b) => b.enabled !== undefined || b.sensitivity !== undefined, "nothing to change");

/** The caller's role on the site, or the response that ends the request. */
async function access(c: Context<{ Variables: AuthVars }>, deps: Deps) {
  const websiteId = c.req.param("website_id") ?? "";
  const userId = requireUser(c);
  if (!userId) return { error: c.json({ error: "unauthorized" }, 401) } as const;
  if (!UUID.test(websiteId)) return { error: c.json({ error: "invalid website id" }, 400) } as const;
  const role = await deps.websites.getRole(websiteId, userId);
  if (!role) return { error: c.json({ error: "website not found or access denied" }, 403) } as const;
  return { websiteId, userId, role, canManage: roleAtLeast(role, "admin") } as const;
}

/**
 * GET /alerts/:website_id?status=open|all — the site's anomalies (open ones, and the last two
 * weeks' resolved ones with `all`), its alert settings, and whether the caller may change them.
 * Stored rows only: reading never runs a check or calls a model.
 */
export function listAlerts(deps: Deps) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const a = await access(c, deps);
    if ("error" in a) return a.error;
    const status = c.req.query("status") === "open" ? "open" : "all";
    const [alerts, settings] = await Promise.all([deps.alerts.list(a.websiteId, status), deps.alerts.settings(a.websiteId)]);
    return c.json({ data: { alerts, settings, canManage: a.canManage } });
  };
}

/** GET /alerts/:website_id/settings — any member may read them. */
export function getAlertSettings(deps: Deps) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const a = await access(c, deps);
    if ("error" in a) return a.error;
    return c.json({ data: { ...(await deps.alerts.settings(a.websiteId)), canManage: a.canManage } });
  };
}

/**
 * PUT /alerts/:website_id/settings — `{ enabled?, sensitivity? }`. Owners and admins only:
 * alerts email everyone with access, so who may silence or sharpen them is the same as who may
 * manage the team.
 */
export function putAlertSettings(deps: Deps) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const a = await access(c, deps);
    if ("error" in a) return a.error;
    if (!a.canManage) return c.json({ error: "Only the site's owner or an admin can change alert settings." }, 403);
    const parsed = settingsBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "invalid settings" }, 400);
    const current = await deps.alerts.settings(a.websiteId);
    const saved = await deps.alerts.saveSettings(a.websiteId, { ...current, ...parsed.data }, a.userId);
    return c.json({ data: { ...saved, canManage: true } });
  };
}
