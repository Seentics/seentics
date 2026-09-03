import { and, eq } from "drizzle-orm";
import { db, websiteMembers, websites } from "../../../db";
import { normalizeWebsiteRole, roleAtLeast, type WebsiteRole } from "../interfaces";

/**
 * Resolve the caller's role on a website, or `null` when they have none.
 *
 * The website's own `user_id` outranks the membership table: an owner need not have a
 * row in `website_members`, and if they do, owning the site still wins.
 */
export async function websiteRoleFor(
  userId: string,
  websiteId: string,
): Promise<WebsiteRole | null> {
  const [owned] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, userId)))
    .limit(1);
  if (owned) return "owner";

  const [member] = await db
    .select({ role: websiteMembers.role })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.userId, userId), eq(websiteMembers.websiteId, websiteId)))
    .limit(1);
  // Normalised, not trusted: an unrecognised stored string fails closed to `viewer`.
  return member ? normalizeWebsiteRole(member.role) : null;
}

/**
 * Assert the caller holds at least `minimum` on this website, and return their role.
 *
 * **`minimum` is required on purpose.** This function used to take only a user and a
 * website, and it answered by checking whether a membership row *existed* — it never
 * read the `role` column at all. Every operation guarded by it was therefore open to
 * every collaborator: a viewer could delete the website (cascading its analytics,
 * automations and funnels), publish its dashboard to a public URL, add and remove
 * members, invite people as owner, and set their own role to owner in one request.
 *
 * Making the minimum a parameter with no default is the point. A caller that has not
 * thought about privilege cannot compile, which is the property the previous signature
 * lacked — the role model existed the whole time, and exactly one endpoint used it.
 *
 * Returns the role so a caller needing finer rules (`updateMemberRole` comparing the
 * grant against the granter) does not pay for a second lookup.
 */
export async function assertWebsiteAccess(
  userId: string,
  websiteId: string,
  minimum: WebsiteRole,
): Promise<WebsiteRole> {
  const role = await websiteRoleFor(userId, websiteId);

  // Same 403 for "no access" and "not enough access": distinguishing them tells a
  // caller which website ids exist and who collaborates on them.
  if (!role || !roleAtLeast(role, minimum)) throw forbidden();

  return role;
}

function forbidden(): Error & { status: number } {
  const err = new Error("forbidden") as Error & { status: number };
  err.status = 403;
  return err;
}
