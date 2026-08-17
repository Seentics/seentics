import { and, eq } from "drizzle-orm";
import { db, websiteMembers, websites } from "../../db";
import { resolveWebsiteIds } from "../../lib/website-resolve";

export async function assertWebsiteAccess(userId: string, websiteParam: string) {
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [m] = await db
    .select({ id: websiteMembers.id })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.userId, userId), eq(websiteMembers.websiteId, uuidStr)))
    .limit(1);
  if (m) return uuidStr;
  const [o] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, uuidStr), eq(websites.userId, userId)))
    .limit(1);
  if (o) return uuidStr;
  const err = new Error("forbidden");
  (err as Error & { status: number }).status = 403;
  throw err;
}
