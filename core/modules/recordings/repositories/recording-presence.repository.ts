import { sql } from "../../../db";

/** Which of these sessions have a recording on this website. */
export async function recordedSessions(websiteId: string, sessionIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(sessionIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const rows = await sql<{ session_id: string }[]>`
    SELECT DISTINCT session_id FROM session_replays
    WHERE website_id = ${websiteId} AND session_id = ANY(${ids}::text[])
  `;
  return new Set(rows.map((r) => r.session_id));
}
