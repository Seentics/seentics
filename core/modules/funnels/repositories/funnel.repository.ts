import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { CreateFunnelBody, FunnelUpdatePatch } from "../lib/api-types";
import { db, funnels, sql as pgSql } from "../db";
import * as ws from "./websites.service";
import { resolveWebsiteIds } from "../lib/website-resolve";

/** Event `type` values in the tracker `funnels` batch (persisted to `analytics_events`). */
export const TRACKER_FUNNEL_EVENT_TYPES = new Set(["funnel_step", "funnel_complete"]);

function mapFunnel(row: typeof funnels.$inferSelect) {
  const steps = (row.steps as Record<string, unknown>[])
    .map((s, i) => ({
      id: String(s.id ?? `step-${i}`),
      name: String(s.name ?? ""),
      order: Number(s.order ?? i),
      step_type: String(s.step_type ?? s.stepType ?? "page_view"),
      page_path: (s.page_path ?? s.pagePath) as string | undefined,
      event_type: (s.event_type ?? s.eventType) as string | undefined,
      match_type: String(s.match_type ?? s.matchType ?? "exact") as "exact" | "contains" | "starts_with" | "regex",
    }))
    .sort((a, b) => a.order - b.order);
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
  if (ids.length === 0) return;
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db
    .delete(funnels)
    .where(and(inArray(funnels.id, ids), eq(funnels.websiteId, uuidStr)));
}

export async function stats(
  userId: string,
  websiteParam: string,
  funnelId: string,
  query: Record<string, string | undefined> = {},
) {
  const g = await get(userId, websiteParam, funnelId);
  if (!g) return null;

  const { siteId } = await resolveWebsiteIds(websiteParam);
  const days = Math.min(366, Math.max(1, Math.floor(Number(query.days ?? 30) || 30)));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // Single pass over the events range: funnel_complete rows are bucketed to
  // step_order = -1, funnel_step rows to their (properties->>'step') index.
  const rows = await pgSql<{ step_order: number | null; cnt: number }[]>`
    SELECT
      CASE WHEN event_type = 'funnel_complete' THEN -1
           ELSE (properties->>'step')::int END AS step_order,
      COUNT(DISTINCT COALESCE(NULLIF(TRIM(visitor_id), ''), session_id))::int AS cnt
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type IN ('funnel_step', 'funnel_complete')
      AND properties->>'funnel_id' = ${funnelId}
      AND occurred_at >= ${startIso}::timestamptz
      AND occurred_at <= ${endIso}::timestamptz
    GROUP BY step_order
    ORDER BY step_order ASC
  `;

  const stepRows = rows;
  const totalEntries = stepRows.find((r) => r.step_order === 0)?.cnt ?? 0;
  const completions = stepRows.find((r) => r.step_order === -1)?.cnt ?? 0;
  const conversionRate =
    totalEntries > 0 ? Math.round((completions / totalEntries) * 1000) / 10 : 0;

  const steps = g.data.steps;
  const stepBreakdown = steps.map((s, idx) => {
    const current = stepRows.find((r) => r.step_order === idx)?.cnt ?? 0;
    const prev =
      idx === 0
        ? totalEntries
        : (stepRows.find((r) => r.step_order === idx - 1)?.cnt ?? 0);
    const dropoffCount = Math.max(0, prev - current);
    const dropoffRate =
      prev > 0 ? Math.round((dropoffCount / prev) * 1000) / 10 : 0;
    return {
      stepOrder: idx,
      stepName: s.name,
      count: current,
      dropoffCount,
      dropoffRate,
    };
  });

  return {
    data: {
      totalEntries,
      completions,
      conversionRate,
      stepBreakdown,
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
