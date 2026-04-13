import { eq } from "drizzle-orm";
import { db, websites } from "../db";

export async function getWebsiteBySiteId(
  siteId: string,
): Promise<{ id: string; heatmapLayoutEnabled: boolean } | null> {
  const rows = await db
    .select({
      id: websites.id,
      heatmapLayoutEnabled: websites.heatmapLayoutEnabled,
    })
    .from(websites)
    .where(eq(websites.siteId, siteId))
    .limit(1);
  const w = rows[0];
  if (!w) return null;
  return { id: w.id, heatmapLayoutEnabled: w.heatmapLayoutEnabled };
}

export async function getSiteIdByWebsiteUuid(websiteUuid: string): Promise<string | null> {
  const rows = await db
    .select({ siteId: websites.siteId })
    .from(websites)
    .where(eq(websites.id, websiteUuid))
    .limit(1);
  return rows[0]?.siteId ?? null;
}
