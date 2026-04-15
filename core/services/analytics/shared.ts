/**
 * Shared helpers for analytics read models (see db/schema.ts indexed columns).
 */
import { sql as dsql } from "drizzle-orm";
import { analyticsEvents } from "../../db";
import { resolveWebsiteIds } from "../../lib/website-resolve";

export function parseDays(q: string | undefined, def = 7): number {
  const n = Number(q ?? def);
  return Number.isFinite(n) && n > 0 && n < 366 ? Math.floor(n) : def;
}

export async function resolveSiteId(websiteParam: string): Promise<{ siteId: string; uuid: string }> {
  const { siteId, uuidStr } = await resolveWebsiteIds(websiteParam);
  return { siteId, uuid: uuidStr };
}

/** Prefer visitor_id; fall back to session_id so rows aren’t dropped from DISTINCT when vid is null. */
export function countDistinctVisitorsSql() {
  return dsql<number>`count(distinct coalesce(nullif(trim(${analyticsEvents.visitorId}), ''), ${analyticsEvents.sessionId}))::int`;
}

export function occurredAtToIso(v: Date | string): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}
