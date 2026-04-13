import { eq, or } from "drizzle-orm";
import { db, websites } from "../db";

const idCache = new Map<string, { siteId: string; uuidStr: string; exp: number }>();
const TTL_MS = 5 * 60 * 1000;

/** Resolve public website param (UUID or site_id) to storage site_id + canonical UUID string. */
export async function resolveWebsiteIds(websiteParam: string): Promise<{ siteId: string; uuidStr: string }> {
  const now = Date.now();
  const hit = idCache.get(websiteParam);
  if (hit && hit.exp > now) return { siteId: hit.siteId, uuidStr: hit.uuidStr };

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      websiteParam,
    );

  let siteId: string;
  let uuidStr: string;

  if (isUuid) {
    const rows = await db.select().from(websites).where(eq(websites.id, websiteParam)).limit(1);
    const w = rows[0];
    if (!w) throw new Error("website not found");
    siteId = w.siteId;
    uuidStr = websiteParam;
  } else {
    const rows = await db.select().from(websites).where(eq(websites.siteId, websiteParam)).limit(1);
    const w = rows[0];
    if (!w) throw new Error("website not found");
    siteId = websiteParam;
    uuidStr = w.id;
  }

  idCache.set(websiteParam, { siteId, uuidStr, exp: now + TTL_MS });
  return { siteId, uuidStr };
}

/** Best-effort resolve: if lookup fails, return param for both (matches Go fallback). */
export async function resolveWebsiteIdsLenient(
  websiteParam: string,
): Promise<{ siteId: string; uuidStr: string }> {
  try {
    return await resolveWebsiteIds(websiteParam);
  } catch {
    return { siteId: websiteParam, uuidStr: websiteParam };
  }
}
