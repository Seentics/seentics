import { and, eq } from "drizzle-orm";
import { db, websiteMembers, websites } from "../db";
import { resolveWebsiteIds } from "../lib/website-resolve";

/** Owner shortcut: website.user_id match (dashboard owner may not be in website_members in all setups). */
export async function assertOwnerOrMember(userId: string, websiteParam: string): Promise<void> {
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const member = await db
    .select({ id: websiteMembers.id })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.userId, userId), eq(websiteMembers.websiteId, uuidStr)))
    .limit(1);
  if (member.length > 0) return;

  const owner = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, uuidStr), eq(websites.userId, userId)))
    .limit(1);
  if (owner.length > 0) return;

  const err = new Error("forbidden");
  (err as Error & { status: number }).status = 403;
  throw err;
}
