import { resolveWebsiteIds } from "../../lib/website-resolve";

export function parseDays(q: string | undefined, def = 7): number {
  const n = Number(q ?? def);
  return Number.isFinite(n) && n > 0 && n < 366 ? Math.floor(n) : def;
}

export async function resolveSiteId(websiteParam: string): Promise<{ siteId: string; uuid: string }> {
  const { siteId, uuidStr } = await resolveWebsiteIds(websiteParam);
  return { siteId, uuid: uuidStr };
}

export function occurredAtToIso(v: Date | string): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}
