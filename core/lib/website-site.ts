import { eq } from "drizzle-orm";
import { db, websites } from "../db";

const SITE_CACHE_TTL_MS = 3 * 60_000;

const bySiteIdCache = new Map<string, { id: string; heatmapLayoutEnabled: boolean; at: number }>();
const byUuidCache = new Map<string, { siteId: string; at: number }>();

function sweepSiteCaches(): void {
  const cutoff = Date.now() - SITE_CACHE_TTL_MS;
  for (const [k, v] of bySiteIdCache) { if (v.at < cutoff) bySiteIdCache.delete(k); }
  for (const [k, v] of byUuidCache) { if (v.at < cutoff) byUuidCache.delete(k); }
}

export async function getWebsiteBySiteId(
  siteId: string,
): Promise<{ id: string; heatmapLayoutEnabled: boolean } | null> {
  const now = Date.now();
  const hit = bySiteIdCache.get(siteId);
  if (hit && now - hit.at < SITE_CACHE_TTL_MS) return { id: hit.id, heatmapLayoutEnabled: hit.heatmapLayoutEnabled };

  const rows = await db
    .select({ id: websites.id, heatmapLayoutEnabled: websites.heatmapLayoutEnabled })
    .from(websites)
    .where(eq(websites.siteId, siteId))
    .limit(1);
  const w = rows[0];
  if (!w) return null;
  if (Math.random() < 0.05) sweepSiteCaches();
  bySiteIdCache.set(siteId, { id: w.id, heatmapLayoutEnabled: w.heatmapLayoutEnabled, at: now });
  return { id: w.id, heatmapLayoutEnabled: w.heatmapLayoutEnabled };
}

export async function getSiteIdByWebsiteUuid(websiteUuid: string): Promise<string | null> {
  const now = Date.now();
  const hit = byUuidCache.get(websiteUuid);
  if (hit && now - hit.at < SITE_CACHE_TTL_MS) return hit.siteId;

  const rows = await db
    .select({ siteId: websites.siteId })
    .from(websites)
    .where(eq(websites.id, websiteUuid))
    .limit(1);
  const siteId = rows[0]?.siteId ?? null;
  if (siteId) {
    if (Math.random() < 0.05) sweepSiteCaches();
    byUuidCache.set(websiteUuid, { siteId, at: now });
  }
  return siteId;
}
