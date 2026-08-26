import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, websiteMembers, websiteInvitations, websites } from "../../../db";
import type { UserDirectory } from "../../auth/interfaces";
import type { AddWebsiteMemberBody } from "../../../platform/lib/api-types";
import { assertWebsiteAccess } from "./access";

/**
 * Members of a website, with each person's name and email.
 *
 * Two queries rather than one `innerJoin` on `users`: that table belongs to auth, so
 * names come through `UserDirectory.listByIds`, which is batched precisely so this stays
 * two round trips instead of one per member. A member whose user row has since been
 * deleted keeps its membership row and reports empty strings, matching what the join
 * would have dropped silently.
 */
export async function listMembers(
  userId: string,
  websiteId: string,
  directory: UserDirectory,
) {
  await assertWebsiteAccess(userId, websiteId);
  const rows = await db
    .select({
      id: websiteMembers.id,
      websiteId: websiteMembers.websiteId,
      userId: websiteMembers.userId,
      role: websiteMembers.role,
      createdAt: websiteMembers.createdAt,
    })
    .from(websiteMembers)
    .where(eq(websiteMembers.websiteId, websiteId))
    .orderBy(asc(websiteMembers.createdAt));

  const people = await directory.listByIds(rows.map((m) => m.userId));

  return {
    data: rows.map((m) => ({
      id: m.id,
      websiteId: m.websiteId,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      userName: people.get(m.userId)?.name ?? "",
      userEmail: people.get(m.userId)?.email ?? "",
    })),
  };
}

export async function addMember(
  userId: string,
  websiteId: string,
  body: AddWebsiteMemberBody,
  directory: UserDirectory,
) {
  await assertWebsiteAccess(userId, websiteId);
  const target = await directory.findByEmail(body.email);
  if (!target) throw new Error("user not found");
  const [existing] = await db
    .select()
    .from(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, websiteId), eq(websiteMembers.userId, target.id)))
    .limit(1);
  if (existing) return { data: existing };
  const [m] = await db
    .insert(websiteMembers)
    .values({
      websiteId: websiteId,
      userId: target.id,
      role: body.role ?? "viewer",
    })
    .returning();
  return { data: m };
}

export async function removeMember(userId: string, websiteId: string, memberUserId: string) {
  await assertWebsiteAccess(userId, websiteId);
  await db
    .delete(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, websiteId), eq(websiteMembers.userId, memberUserId)));
}

export async function updateMemberRole(
  userId: string,
  websiteId: string,
  memberUserId: string,
  role: string,
) {
  await assertWebsiteAccess(userId, websiteId);
  await db
    .update(websiteMembers)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(websiteMembers.websiteId, websiteId), eq(websiteMembers.userId, memberUserId)));
}

export async function getMyRole(userId: string, websiteId: string) {
  await assertWebsiteAccess(userId, websiteId);
  const [m] = await db
    .select({ role: websiteMembers.role })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, websiteId), eq(websiteMembers.userId, userId)))
    .limit(1);
  if (m) return { data: { role: m.role } };
  const [w] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, userId)))
    .limit(1);
  if (w) return { data: { role: "owner" } };
  return { data: { role: "viewer" } };
}

// ─── Invitations ──────────────────────────────────────────────────────────────

function makeToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function mapInvitation(r: typeof websiteInvitations.$inferSelect) {
  return {
    id: r.id,
    websiteId: r.websiteId,
    email: r.email,
    role: r.role,
    token: r.token,
    invitedBy: r.invitedBy,
    expiresAt: r.expiresAt.toISOString(),
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function createInvitation(
  userId: string,
  websiteId: string,
  body: { email: string; role: string },
) {
  await assertWebsiteAccess(userId, websiteId);
  const email = body.email.trim().toLowerCase();

  // Delete any existing pending invitation for this email+website so the new one replaces it
  await db
    .delete(websiteInvitations)
    .where(
      and(
        eq(websiteInvitations.websiteId, websiteId),
        eq(websiteInvitations.email, email),
        isNull(websiteInvitations.acceptedAt),
      ),
    );

  const token     = makeToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [inv] = await db
    .insert(websiteInvitations)
    .values({ websiteId: websiteId, email, role: body.role ?? "viewer", token, invitedBy: userId, expiresAt })
    .returning();

  return { data: mapInvitation(inv!) };
}

export async function listInvitations(userId: string, websiteId: string) {
  await assertWebsiteAccess(userId, websiteId);
  const rows = await db
    .select()
    .from(websiteInvitations)
    .where(and(eq(websiteInvitations.websiteId, websiteId), isNull(websiteInvitations.acceptedAt)))
    .orderBy(desc(websiteInvitations.createdAt));
  return { data: rows.map(mapInvitation) };
}

export async function revokeInvitation(
  userId: string,
  websiteId: string,
  invitationId: string,
) {
  await assertWebsiteAccess(userId, websiteId);
  await db
    .delete(websiteInvitations)
    .where(and(eq(websiteInvitations.id, invitationId), eq(websiteInvitations.websiteId, websiteId)));
}

export async function acceptInvitationByToken(
  userId: string,
  token: string,
  directory: UserDirectory,
) {
  const [inv] = await db
    .select()
    .from(websiteInvitations)
    .where(eq(websiteInvitations.token, token))
    .limit(1);

  if (!inv)           { const e = new Error("Invalid or expired invitation link"); (e as any).status = 404; throw e; }
  if (inv.acceptedAt) { const e = new Error("Invitation has already been accepted"); (e as any).status = 400; throw e; }
  if (new Date() > inv.expiresAt) { const e = new Error("Invitation has expired"); (e as any).status = 400; throw e; }

  const u = await directory.getById(userId);
  if (!u) { const e = new Error("User not found"); (e as any).status = 404; throw e; }
  if (u.email.toLowerCase() !== inv.email.toLowerCase()) {
    const e = new Error(`This invitation was sent to ${inv.email}. Please sign in with that account.`);
    (e as any).status = 403;
    throw e;
  }

  // Upsert membership
  const [existing] = await db
    .select()
    .from(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, inv.websiteId), eq(websiteMembers.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .update(websiteMembers)
      .set({ role: inv.role, updatedAt: new Date() })
      .where(eq(websiteMembers.id, existing.id));
  } else {
    await db.insert(websiteMembers).values({ websiteId: inv.websiteId, userId, role: inv.role });
  }

  await db
    .update(websiteInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(websiteInvitations.id, inv.id));

  return { data: { websiteId: inv.websiteId } };
}
