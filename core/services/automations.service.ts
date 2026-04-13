import { and, desc, eq } from "drizzle-orm";
import type { AutomationUpdatePatch, CreateAutomationBody } from "../lib/api-types";
import { automationEvents, automations, db } from "../db";
import * as ws from "./websites.service";
import { resolveWebsiteIds } from "../lib/website-resolve";

export async function list(userId: string, websiteParam: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select()
    .from(automations)
    .where(eq(automations.websiteId, uuidStr))
    .orderBy(desc(automations.createdAt));
  return {
    data: rows.map((a) => ({
      id: a.id,
      website_id: a.websiteId,
      name: a.name,
      definition: a.definition,
      is_active: a.isActive,
      created_at: a.createdAt.toISOString(),
      updated_at: a.updatedAt.toISOString(),
    })),
  };
}

export async function create(userId: string, websiteParam: string, body: CreateAutomationBody) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [row] = await db
    .insert(automations)
    .values({
      websiteId: uuidStr,
      userId,
      name: body.name,
      definition: body.definition,
      isActive: body.is_active ?? true,
    })
    .returning();
  return { data: row };
}

export async function get(userId: string, websiteParam: string, id: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)))
    .limit(1);
  return row ? { data: row } : null;
}

export async function update(
  userId: string,
  websiteParam: string,
  id: string,
  patch: AutomationUpdatePatch,
) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [row] = await db
    .update(automations)
    .set({
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.definition != null ? { definition: patch.definition } : {}),
      ...(patch.is_active != null ? { isActive: patch.is_active } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)))
    .returning();
  return row ? { data: row } : null;
}

export async function remove(userId: string, websiteParam: string, id: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db.delete(automationEvents).where(eq(automationEvents.automationId, id));
  await db.delete(automations).where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)));
}

export async function bulkDelete(userId: string, websiteParam: string, ids: string[]) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  for (const id of ids) {
    await db.delete(automationEvents).where(eq(automationEvents.automationId, id));
    await db.delete(automations).where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)));
  }
}

export async function executions(userId: string, websiteParam: string, id: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [a] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)))
    .limit(1);
  if (!a) return null;
  const rows = await db
    .select()
    .from(automationEvents)
    .where(eq(automationEvents.automationId, id))
    .orderBy(desc(automationEvents.createdAt))
    .limit(100);
  return { data: rows };
}

export async function activeForTracker(websiteParam: string) {
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  return await db
    .select()
    .from(automations)
    .where(and(eq(automations.websiteId, uuidStr), eq(automations.isActive, true)));
}
