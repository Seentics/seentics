import { and, eq, or, sql } from "drizzle-orm";
import { db, websiteMembers, websites } from "../../../db";
import { resolveWebsiteIds } from "../../../platform/lib/website-resolve";

/**
 * Grant access if the user owns the website (websites.user_id) OR is a member
 * (website_members). One query via LEFT JOIN instead of two sequential lookups —
 * this runs on nearly every authenticated request.
 */
export async function assertOwnerOrMember(userId: string, websiteParam: string): Promise<void> {
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select({ ok: sql<number>`1` })
    .from(websites)
    .leftJoin(
      websiteMembers,
      and(eq(websiteMembers.websiteId, websites.id), eq(websiteMembers.userId, userId)),
    )
    .where(
      and(
        eq(websites.id, uuidStr),
        or(eq(websites.userId, userId), sql`${websiteMembers.id} IS NOT NULL`),
      ),
    )
    .limit(1);
  if (rows.length > 0) return;

  const err = new Error("forbidden");
  (err as Error & { status: number }).status = 403;
  throw err;
}
