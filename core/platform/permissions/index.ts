import type { Context } from "hono";

/**
 * What the caller may do, as decided by the gateway.
 *
 * Core computes its own per-website roles and keeps doing so — it owns which
 * websites exist and who they belong to, and the gateway's grants are built on
 * top of that, not instead of it. What Core cannot know is whether the person
 * behind a valid website role has been narrowed by a custom team role, or —
 * for a client user of an agency — by the pages their client may open, which
 * is what `X-Team-Permissions` carries.
 *
 * The header is trustworthy for one reason: the gateway deletes any copy the
 * client sent before setting its own. Nothing here can verify that, which is
 * why the absent-header case below is the only interesting decision.
 */

/**
 * The dashboard pages a permission can open or change, one `analytics:<feature>.view` and
 * `.manage` pair each. The same ids name a client's `dashboard_features` (off | view | edit),
 * which is how the gateway turns a client user's access into keys: `view` grants `.view`,
 * `edit` grants both. `funnels.view`, `funnels.manage`, `goals.manage` and `privacy.manage`
 * predate the list and are simply members of it.
 */
export const ANALYTICS_FEATURES = [
  "overview",
  "events",
  "paths",
  "revenue",
  "recordings",
  "heatmaps",
  "funnels",
  "goals",
  "automations",
  "leads",
  "conversions",
  "ai",
  "errors",
  "privacy",
] as const;

export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];

type FeaturePermission = `analytics:${AnalyticsFeature}.${"view" | "manage"}`;

const FEATURE_PERMISSIONS = ANALYTICS_FEATURES.flatMap((feature) => [
  `analytics:${feature}.view` as const,
  `analytics:${feature}.manage` as const,
]) as FeaturePermission[];

export const PERMISSIONS = [
  // May open the website at all — its record, members list, goals. Not a page of its own.
  "analytics:dashboard.view",
  ...FEATURE_PERMISSIONS,
  "analytics:apikeys.manage",
  "analytics:settings.manage",
  // The agency workspace (/api/v1/agency). Checked by the gateway before it forwards; listed
  // here so both sides name the same key.
  "team:agency.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type PermissionRole = "owner" | "admin" | "member" | "viewer";

const VIEW_ONLY = PERMISSIONS.filter((key) => key.endsWith(".view"));

/**
 * What each website role may do at most, mirroring the gateway's built-in team roles.
 *
 * Core's second line: the header can narrow a role, never widen it. A client user resolves to
 * `member` or `viewer` (see `findRole`), so whatever keys their client's features produce, a
 * viewer never manages and nobody below admin touches settings, keys or privacy.
 *
 * A member manages what a member's website role already could: funnels, goals, recordings,
 * heatmaps, automations, leads, conversions and errors.
 */
export const ROLE_PERMISSIONS: Record<PermissionRole, readonly Permission[]> = {
  viewer: VIEW_ONLY,
  member: [
    ...VIEW_ONLY,
    "analytics:funnels.manage",
    "analytics:goals.manage",
    "analytics:recordings.manage",
    "analytics:heatmaps.manage",
    "analytics:automations.manage",
    "analytics:leads.manage",
    "analytics:conversions.manage",
    "analytics:errors.manage",
  ],
  admin: PERMISSIONS,
  owner: PERMISSIONS,
};

export function roleAllows(role: PermissionRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

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

/**
 * Keys that hold another without naming it. `.manage` includes the page's `.view`, and any
 * page's `.view` includes `dashboard.view`: a client user's keys are built from the pages
 * their client may open, and a caller who may open one page may open the website it is on.
 */
function implied(held: Set<string>, permission: Permission): boolean {
  if (held.has(permission)) return true;
  if (permission.endsWith(".view") && held.has(permission.replace(/\.view$/, ".manage"))) return true;
  if (permission === "analytics:dashboard.view") {
    return FEATURE_PERMISSIONS.some((key) => held.has(key));
  }
  return false;
}

export function can(c: Context, permission: Permission): boolean {
  const held = permissionsFrom(c);
  return held === null || implied(held, permission);
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
