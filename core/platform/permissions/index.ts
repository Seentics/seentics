import type { Context } from "hono";

/**
 * What the caller may do, as decided by the gateway.
 *
 * Core computes its own per-website roles and keeps doing so — it owns which
 * websites exist and who they belong to, and the gateway's grants are built on
 * top of that, not instead of it. What Core cannot know is whether the person
 * behind a valid website role has been narrowed by a custom team role, which
 * is what `X-Team-Permissions` carries.
 *
 * The header is trustworthy for one reason: the gateway deletes any copy the
 * client sent before setting its own. Nothing here can verify that, which is
 * why the absent-header case below is the only interesting decision.
 */

export const PERMISSIONS = [
  "analytics:dashboard.view",
  "analytics:funnels.view",
  "analytics:funnels.manage",
  "analytics:goals.manage",
  "analytics:privacy.manage",
  "analytics:apikeys.manage",
  "analytics:settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const HEADER = "X-Team-Permissions";

/**
 * Whether this process runs behind the gateway.
 *
 * Behind it, a missing permission header means something is wrong — an old
 * gateway, or a request that arrived by another route — and the safe reading
 * is "no permissions". In an OSS or standalone run there is no gateway to have
 * sent one and no team model to consult, so nothing is gated.
 */
function behindGateway(): boolean {
  return Boolean(process.env.GLOBAL_API_KEY);
}

/**
 * The caller's permissions, or null when this deployment has no gateway.
 *
 * An empty header is not the same as an absent one: it means the gateway
 * resolved a team and the caller holds nothing in this product, which is a
 * decision rather than a gap.
 */
export function permissionsFrom(c: Context): Set<string> | null {
  const raw = c.req.header(HEADER);
  if (raw === undefined) return behindGateway() ? new Set() : null;
  return new Set(
    raw
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  );
}

export function can(c: Context, permission: Permission): boolean {
  const held = permissionsFrom(c);
  return held === null || held.has(permission);
}

/**
 * Refuse unless the caller holds `permission`, returning the response to send.
 *
 * 403 rather than 404, unlike `requireWebsiteAccess`'s answer for a website
 * that is not yours: by the time this runs the caller has proven they may see
 * the website, so hiding the route protects nothing and only makes a
 * permissions problem look like a missing feature.
 */
export function permissionDenied(c: Context, permission: Permission): Response | null {
  return can(c, permission) ? null : c.json({ error: "forbidden" }, 403);
}
