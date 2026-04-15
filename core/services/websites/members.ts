import { and, asc, eq } from "drizzle-orm";
import { db, users, websiteMembers, websites } from "../../db";
import type { AddWebsiteMemberBody } from "../../lib/api-types";
import { resolveWebsiteIds } from "../../lib/website-resolve";
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
      website_id: m.websiteId,
      user_id: m.userId,
      role: m.role,
      created_at: m.createdAt.toISOString(),
      user_name: m.userName,
      user_email: m.userEmail,
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
      role: body.role ?? "member",
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
