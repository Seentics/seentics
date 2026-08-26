import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, funnels } from "../../../db";
import type {
  CreateFunnelInput,
  Funnel,
  FunnelStep,
  UpdateFunnelInput,
} from "../interfaces";

/**
 * Persistence for funnel definitions.
 *
 * Every function here takes `websiteId` — `funnels.website_id` is a `uuid` column
 * referencing `websites.id`, never the short `website_id`. The parameter is named for
 * the identifier rather than for the caller's URL segment so a `websiteId` slipping in
 * is visible at the call site; the compiler cannot help, both are `string`.
 */

/**
 * Normalize a stored step into the wire shape.
 *
 * `steps` is free-form JSONB written by several generations of the builder, so both
 * `snake_case` and `camelCase` spellings exist in live rows and neither is
 * guaranteed present. Sorting by `order` here rather than trusting array position
 * is load-bearing: the report indexes steps positionally.
 */
function mapSteps(raw: Record<string, unknown>[]): FunnelStep[] {
  return raw
    .map((s, i) => ({
      id: String(s.id ?? `step-${i}`),
      name: String(s.name ?? ""),
      order: Number(s.order ?? i),
      step_type: String(s.step_type ?? s.stepType ?? "page_view"),
      page_path: (s.page_path ?? s.pagePath) as string | undefined,
      event_type: (s.event_type ?? s.eventType) as string | undefined,
      match_type: String(s.match_type ?? s.matchType ?? "exact") as FunnelStep["match_type"],
    }))
    .sort((a, b) => a.order - b.order);
}

function mapFunnel(row: typeof funnels.$inferSelect): Funnel {
  const steps = mapSteps(row.steps as Record<string, unknown>[]);
  return {
    id: row.id,
    website_id: row.id,
    user_id: row.userId,
    name: row.name,
    description: row.description ?? "",
    is_active: row.isActive,
    steps,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    // Zeroed rather than omitted: the funnel list renders these cells before the
    // per-funnel report request resolves, and an absent `stats` renders as NaN.
    stats: {
      totalEntries: 0,
      completions: 0,
      conversionRate: 0,
      stepBreakdown: steps.map((_s, idx) => ({
        stepOrder: idx,
        count: 0,
        dropoffCount: 0,
        dropoffRate: 0,
      })),
    },
  };
}

export async function listFunnels(websiteId: string): Promise<Funnel[]> {
  const rows = await db
    .select()
    .from(funnels)
    .where(eq(funnels.websiteId, websiteId))
    .orderBy(desc(funnels.createdAt));
  return rows.map(mapFunnel);
}

export async function findFunnel(websiteId: string, funnelId: string): Promise<Funnel | null> {
  const [row] = await db
    .select()
    .from(funnels)
    // Scoped by website as well as id so a funnel id guessed from another account
    // reads as "not found" rather than leaking the definition.
    .where(and(eq(funnels.id, funnelId), eq(funnels.websiteId, websiteId)))
    .limit(1);
  return row ? mapFunnel(row) : null;
}

export async function insertFunnel(
  websiteId: string,
  userId: string,
  input: CreateFunnelInput,
): Promise<Funnel> {
  const [row] = await db
    .insert(funnels)
    .values({
      websiteId: websiteId,
      userId,
      name: input.name,
      description: input.description ?? null,
      isActive: input.is_active ?? true,
      steps: input.steps ?? [],
    })
    .returning();
  return mapFunnel(row!);
}

export async function updateFunnel(
  websiteId: string,
  funnelId: string,
  patch: UpdateFunnelInput,
): Promise<Funnel | null> {
  const [row] = await db
    .update(funnels)
    .set({
      // Each field is spread in only when present: `description` uses
      // `!== undefined` because an explicit empty string is a real clear, while
      // `name` and `is_active` use `!= null` because neither has a meaningful null.
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.is_active != null ? { isActive: patch.is_active } : {}),
      ...(patch.steps != null ? { steps: patch.steps } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(funnels.id, funnelId), eq(funnels.websiteId, websiteId)))
    .returning();
  return row ? mapFunnel(row) : null;
}

export async function deleteFunnel(websiteId: string, funnelId: string): Promise<void> {
  await db.delete(funnels).where(and(eq(funnels.id, funnelId), eq(funnels.websiteId, websiteId)));
}

export async function deleteFunnels(websiteId: string, funnelIds: string[]): Promise<void> {
  // Guarded here as well as in the service: an empty `inArray` is a query builder
  // edge case, and getting it wrong deletes the website's whole funnel list.
  if (funnelIds.length === 0) return;
  await db
    .delete(funnels)
    .where(and(inArray(funnels.id, funnelIds), eq(funnels.websiteId, websiteId)));
}

/**
 * Active funnels for the tracker, oldest first.
 *
 * Ordering differs from `listFunnels` on purpose — the tracker evaluates them in a
 * stable order that does not shuffle when a new funnel is added.
 */
export async function listActiveFunnels(websiteId: string): Promise<Funnel[]> {
  const rows = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.websiteId, websiteId), eq(funnels.isActive, true)))
    .orderBy(asc(funnels.createdAt));
  return rows.map(mapFunnel);
}
