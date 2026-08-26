import { eq } from "drizzle-orm";
import { db, websites } from "../../../db";
import { newSiteId } from "../lib/ids";
import { assertWebsiteAccess } from "./access";

export async function toggleShare(userId: string, websiteId: string, enabled: boolean) {
  await assertWebsiteAccess(userId, websiteId);
  const publicShareId = enabled ? newSiteId().slice(0, 16) : null;
  await db.update(websites).set({ publicShareId, updatedAt: new Date() }).where(eq(websites.id, websiteId));
  return { data: { public_share_id: publicShareId } };
}
