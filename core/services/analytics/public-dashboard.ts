import { eq } from "drizzle-orm";
import { db, websites } from "../../db";
import { getDashboardStats } from "./dashboard";

export async function getPublicDashboardStats(
  publicId: string,
  query: Record<string, string | undefined>,
) {
  const [w] = await db.select().from(websites).where(eq(websites.publicShareId, publicId)).limit(1);
  if (!w) return null;
  return getDashboardStats(w.id, query);
}
