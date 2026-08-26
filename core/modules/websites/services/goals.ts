import { and, asc, eq } from "drizzle-orm";
import { db, goals } from "../../../db";
import type { CreateGoalBody, UpdateGoalPatch } from "../../../platform/lib/api-types";
import { resolveWebsiteIds } from "../../../platform/lib/website-resolve";
import { assertWebsiteAccess } from "./access";

export async function listGoals(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.websiteId, uuidStr))
    .orderBy(asc(goals.createdAt));
  return {
    data: rows.map((g) => ({
      id: g.id,
      website_id: g.websiteId,
      name: g.name,
      type: g.type,
      identifier: g.identifier,
      selector: g.selector,
      revenue: g.revenue,
      currency: g.currency,
      created_at: g.createdAt.toISOString(),
      updated_at: g.updatedAt.toISOString(),
    })),
  };
}

export async function createGoal(userId: string, websiteParam: string, body: CreateGoalBody) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [g] = await db
    .insert(goals)
    .values({
      websiteId: uuidStr,
      name: body.name,
      type: body.type,
      identifier: body.identifier,
      selector: body.selector ?? null,
    })
    .returning();
  return { data: g };
}

export async function updateGoal(
  userId: string,
  websiteParam: string,
  goalId: string,
  body: UpdateGoalPatch,
) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [g] = await db
    .update(goals)
    .set({
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.type != null ? { type: body.type } : {}),
      ...(body.identifier != null ? { identifier: body.identifier } : {}),
      ...(body.selector !== undefined ? { selector: body.selector } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(goals.id, goalId), eq(goals.websiteId, uuidStr)))
    .returning();
  return g ? { data: g } : null;
}

export async function deleteGoal(userId: string, websiteParam: string, goalId: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.websiteId, uuidStr)));
}
