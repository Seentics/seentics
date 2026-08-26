import { and, eq } from "drizzle-orm";
import { db, websiteMembers, websites } from "../../../db";

export async function assertWebsiteAccess(userId: string, websiteId: string) {
  const [m] = await db
    .select({ id: websiteMembers.id })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.userId, userId), eq(websiteMembers.websiteId, websiteId)))
    .limit(1);
  if (m) return websiteId;
  const [o] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, userId)))
    .limit(1);
  if (o) return websiteId;
  const err = new Error("forbidden");
  (err as Error & { status: number }).status = 403;
  throw err;
}
