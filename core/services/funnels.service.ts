import { and, asc, desc, eq } from "drizzle-orm";
import type { CreateFunnelBody, FunnelUpdatePatch } from "../lib/api-types";
import { db, funnels } from "../db";
import * as ws from "./websites.service";
import { resolveWebsiteIds } from "../lib/website-resolve";

function mapFunnel(row: typeof funnels.$inferSelect) {
  const steps = (row.steps as Record<string, unknown>[]).map((s, i) => ({
    id: String(s.id ?? `step-${i}`),
    name: String(s.name ?? ""),
    order: Number(s.order ?? i),
    step_type: String(s.step_type ?? s.stepType ?? "page_view"),
    page_path: (s.page_path ?? s.pagePath) as string | undefined,
    event_type: (s.event_type ?? s.eventType) as string | undefined,
  }));
  return {
    id: row.id,
    website_id: row.websiteId,
    user_id: row.userId,
    name: row.name,
    description: row.description ?? "",
    is_active: row.isActive,
    steps,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    stats: {
      totalEntries: 0,
      completions: 0,
      conversionRate: 0,
      stepBreakdown: steps.map((s, idx) => ({
        stepOrder: idx,
        count: 0,
        dropoffCount: 0,
        dropoffRate: 0,
      })),
    },
  };
}

export async function list(userId: string, websiteParam: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select()
    .from(funnels)
    .where(eq(funnels.websiteId, uuidStr))
    .orderBy(desc(funnels.createdAt));
  return { data: rows.map(mapFunnel) };
}

export async function create(userId: string, websiteParam: string, body: CreateFunnelBody) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [row] = await db
    .insert(funnels)
    .values({
      websiteId: uuidStr,
      userId,
      name: body.name,
      description: body.description ?? null,
      isActive: body.is_active ?? true,
      steps: body.steps ?? [],
    })
    .returning();
  return { data: mapFunnel(row!) };
}

export async function get(userId: string, websiteParam: string, funnelId: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [row] = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.id, funnelId), eq(funnels.websiteId, uuidStr)))
    .limit(1);
  return row ? { data: mapFunnel(row) } : null;
}

export async function update(
  userId: string,
  websiteParam: string,
  funnelId: string,
  patch: FunnelUpdatePatch,
) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [row] = await db
    .update(funnels)
    .set({
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.is_active != null ? { isActive: patch.is_active } : {}),
      ...(patch.steps != null ? { steps: patch.steps } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(funnels.id, funnelId), eq(funnels.websiteId, uuidStr)))
    .returning();
  return row ? { data: mapFunnel(row) } : null;
}

export async function remove(userId: string, websiteParam: string, funnelId: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db.delete(funnels).where(and(eq(funnels.id, funnelId), eq(funnels.websiteId, uuidStr)));
}

export async function bulkDelete(userId: string, websiteParam: string, ids: string[]) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  for (const id of ids) {
    await db.delete(funnels).where(and(eq(funnels.id, id), eq(funnels.websiteId, uuidStr)));
  }
}

export async function stats(userId: string, websiteParam: string, funnelId: string) {
  const g = await get(userId, websiteParam, funnelId);
  if (!g) return null;
  return {
    data: {
      totalEntries: 0,
      completions: 0,
      conversionRate: 0,
      stepBreakdown: [],
    },
  };
}

/** Public: active funnels for tracker init (by site public id or uuid). */
export async function activeForTracker(websiteParam: string, origin: string) {
  void origin;
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.websiteId, uuidStr), eq(funnels.isActive, true)))
    .orderBy(asc(funnels.createdAt));
  return rows.map(mapFunnel);
}
