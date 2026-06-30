import { sql as pgSql } from "../../db";
import { getDashboardStats } from "./dashboard";

export async function getPublicDashboardStats(
  publicId: string,
  query: Record<string, string | undefined>,
) {
  const rows = await pgSql<{ id: string }[]>`
    SELECT id FROM websites WHERE public_share_id = ${publicId} LIMIT 1
  `;
  if (!rows.length) return null;
  return getDashboardStats(rows[0]!.id, query);
}
