import { and, desc, eq } from "drizzle-orm";
import type { AutomationUpdatePatch, CreateAutomationBody } from "../lib/api-types";
import { automationEvents, automations, db, sql as pgSql } from "../db";
import * as ws from "./websites.service";
import { resolveWebsiteIds } from "../lib/website-resolve";

export async function list(userId: string, websiteParam: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await pgSql<{
    id: string; website_id: string; name: string;
    definition: Record<string, unknown>; is_active: boolean;
    created_at: Date; updated_at: Date;
    total: number; success_count: number; failure_count: number; last30: number;
  }[]>`
    SELECT
      a.id, a.website_id, a.name, a.definition, a.is_active,
      a.created_at, a.updated_at,
      COUNT(e.id) FILTER (WHERE e.record_type = 'server_run')::int              AS total,
      COUNT(e.id) FILTER (WHERE e.record_type = 'action' AND e.status = 'success')::int  AS success_count,
      COUNT(e.id) FILTER (WHERE e.record_type = 'action' AND e.status = 'failed')::int   AS failure_count,
      COUNT(e.id) FILTER (WHERE e.record_type = 'server_run' AND e.created_at >= NOW() - INTERVAL '30 days')::int AS last30
    FROM automations a
    LEFT JOIN automation_events e ON e.automation_id = a.id
    WHERE a.website_id = ${uuidStr}
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `;
  return {
    data: rows.map((a) => {
      const total   = Number(a.total   ?? 0);
      const success = Number(a.success_count ?? 0);
      const failure = Number(a.failure_count ?? 0);
      const actionTotal = success + failure;
      return {
        id:         a.id,
        website_id: a.website_id,
        name:       a.name,
        definition: a.definition,
        is_active:  a.is_active,
        created_at: a.created_at instanceof Date ? a.created_at.toISOString() : String(a.created_at),
        updated_at: a.updated_at instanceof Date ? a.updated_at.toISOString() : String(a.updated_at),
        stats: {
          totalExecutions: total,
          successCount:    success,
          failureCount:    failure,
          successRate:     actionTotal > 0 ? Math.round((success / actionTotal) * 1000) / 10 : (total > 0 ? 100 : 0),
          last30Days:      Number(a.last30 ?? 0),
        },
      };
    }),
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

export async function toggle(userId: string, websiteParam: string, id: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [current] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)))
    .limit(1);
  if (!current) return null;
  const [row] = await db
    .update(automations)
    .set({ isActive: !current.isActive, updatedAt: new Date() })
    .where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)))
    .returning();
  return row ? { data: row } : null;
}

export async function stats(userId: string, websiteParam: string, id: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [a] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)))
    .limit(1);
  if (!a) return null;

  const [totals] = await pgSql<{ total: number; success: number; failure: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE record_type = 'server_run')::int                             AS total,
      COUNT(*) FILTER (WHERE record_type = 'action' AND status = 'success')::int          AS success,
      COUNT(*) FILTER (WHERE record_type = 'action' AND status = 'failed')::int           AS failure
    FROM automation_events
    WHERE automation_id = ${id}
  `;
  const [last30] = await pgSql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt
    FROM automation_events
    WHERE automation_id = ${id}
      AND record_type = 'server_run'
      AND created_at >= NOW() - INTERVAL '30 days'
  `;

  const total   = totals?.total   ?? 0;
  const success = totals?.success ?? 0;
  const failure = totals?.failure ?? 0;
  const actionTotal = success + failure;
  return {
    data: {
      totalExecutions: total,
      successCount:    success,
      failureCount:    failure,
      successRate:     actionTotal > 0 ? Math.round((success / actionTotal) * 1000) / 10 : (total > 0 ? 100 : 0),
      last30Days:      last30?.cnt ?? 0,
    },
  };
}

export async function dailyStats(userId: string, websiteParam: string, id: string) {
  await ws.assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [a] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.websiteId, uuidStr)))
    .limit(1);
  if (!a) return null;

  const rows = await pgSql<{ day: string; runs: number }[]>`
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS runs
    FROM automation_events
    WHERE automation_id = ${id}
      AND created_at >= NOW() - INTERVAL '14 days'
    GROUP BY 1
    ORDER BY 1
  `;

  const map = new Map(rows.map((r) => [r.day, Number(r.runs)]));
  const data = Array.from({ length: 14 }, (_, i) => {
    const d   = new Date(Date.now() - (13 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return { day: `D${i + 1}`, runs: map.get(key) ?? 0 };
  });
  return { data };
}

export async function activeForTracker(websiteParam: string) {
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  return await db
    .select()
    .from(automations)
    .where(and(eq(automations.websiteId, uuidStr), eq(automations.isActive, true)));
}
