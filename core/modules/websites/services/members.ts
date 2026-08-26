import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, users, websiteMembers, websiteInvitations, websites } from "../../../db";
import type { AddWebsiteMemberBody } from "../../../platform/lib/api-types";
import { resolveWebsiteIds } from "../../../platform/lib/website-resolve";
import { assertWebsiteAccess } from "./access";

export async function listMembers(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select({
      id: websiteMembers.id,
      websiteId: websiteMembers.websiteId,
      userId: websiteMembers.userId,
      role: websiteMembers.role,
      createdAt: websiteMembers.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(websiteMembers)
    .innerJoin(users, eq(users.id, websiteMembers.userId))
    .where(eq(websiteMembers.websiteId, uuidStr))
    .orderBy(asc(websiteMembers.createdAt));

  return {
    data: rows.map((m) => ({
      id: m.id,
      websiteId: m.websiteId,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      userName: m.userName,
      userEmail: m.userEmail,
    })),
  };
}

export async function addMember(userId: string, websiteParam: string, body: AddWebsiteMemberBody) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.trim().toLowerCase()))
    .limit(1);
  if (!target) throw new Error("user not found");
  const [existing] = await db
    .select()
    .from(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, uuidStr), eq(websiteMembers.userId, target.id)))
    .limit(1);
  if (existing) return { data: existing };
  const [m] = await db
    .insert(websiteMembers)
    .values({
      websiteId: uuidStr,
      userId: target.id,
      role: body.role ?? "viewer",
    })
    .returning();
  return { data: m };
}

export async function removeMember(userId: string, websiteParam: string, memberUserId: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db
    .delete(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, uuidStr), eq(websiteMembers.userId, memberUserId)));
}

export async function updateMemberRole(
  userId: string,
  websiteParam: string,
  memberUserId: string,
  role: string,
) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db
    .update(websiteMembers)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(websiteMembers.websiteId, uuidStr), eq(websiteMembers.userId, memberUserId)));
}

export async function getMyRole(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [m] = await db
    .select({ role: websiteMembers.role })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, uuidStr), eq(websiteMembers.userId, userId)))
    .limit(1);
  if (m) return { data: { role: m.role } };
  const [w] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, uuidStr), eq(websites.userId, userId)))
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
  websiteParam: string,
  body: { email: string; role: string },
) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const email = body.email.trim().toLowerCase();

  // Delete any existing pending invitation for this email+website so the new one replaces it
  await db
    .delete(websiteInvitations)
    .where(
      and(
        eq(websiteInvitations.websiteId, uuidStr),
        eq(websiteInvitations.email, email),
        isNull(websiteInvitations.acceptedAt),
      ),
    );

  const token     = makeToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [inv] = await db
    .insert(websiteInvitations)
    .values({ websiteId: uuidStr, email, role: body.role ?? "viewer", token, invitedBy: userId, expiresAt })
    .returning();

  return { data: mapInvitation(inv!) };
}

export async function listInvitations(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select()
    .from(websiteInvitations)
    .where(and(eq(websiteInvitations.websiteId, uuidStr), isNull(websiteInvitations.acceptedAt)))
    .orderBy(desc(websiteInvitations.createdAt));
  return { data: rows.map(mapInvitation) };
}

export async function revokeInvitation(
  userId: string,
  websiteParam: string,
  invitationId: string,
) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db
    .delete(websiteInvitations)
    .where(and(eq(websiteInvitations.id, invitationId), eq(websiteInvitations.websiteId, uuidStr)));
}

export async function acceptInvitationByToken(userId: string, token: string) {
  const [inv] = await db
    .select()
    .from(websiteInvitations)
    .where(eq(websiteInvitations.token, token))
    .limit(1);

  if (!inv)           { const e = new Error("Invalid or expired invitation link"); (e as any).status = 404; throw e; }
  if (inv.acceptedAt) { const e = new Error("Invitation has already been accepted"); (e as any).status = 400; throw e; }
  if (new Date() > inv.expiresAt) { const e = new Error("Invitation has expired"); (e as any).status = 400; throw e; }

  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
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
