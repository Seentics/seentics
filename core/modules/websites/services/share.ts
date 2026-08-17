import { eq } from "drizzle-orm";
import { db, websites } from "../../../db";
import { newSiteId } from "../lib/ids";
import { resolveWebsiteIds } from "../../../platform/lib/website-resolve";
import { assertWebsiteAccess } from "./access";

export async function toggleShare(userId: string, websiteParam: string, enabled: boolean) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const publicShareId = enabled ? newSiteId().slice(0, 16) : null;
  await db.update(websites).set({ publicShareId, updatedAt: new Date() }).where(eq(websites.id, uuidStr));
  return { data: { public_share_id: publicShareId } };
}
