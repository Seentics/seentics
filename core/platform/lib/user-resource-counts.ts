import { sql } from "../../db";

export type UserResourceCounts = {
  websites: number;
  funnels: number;
  automations: number;
  heatmaps: number;
  replays: number;
  monthly_events: number;
  ai_analyses: number;
};

/**
 * Returns current usage counts for a user across all their websites.
 * - heatmaps:  distinct (website_id, page_path) rows in heatmap_points
 * - replays:   distinct sessions this calendar month (sequence=0 meta rows)
 * - monthly_events: analytics_events rows this calendar month
 */
export async function getUserResourceCounts(userId: string): Promise<UserResourceCounts> {
  // Validate UUID format to avoid injecting arbitrary strings into queries.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) {
    return { websites: 0, funnels: 0, automations: 0, heatmaps: 0, replays: 0, monthly_events: 0, ai_analyses: 0 };
  }

  // Run all counts in parallel; each is a single indexed query.
  const [
    websitesRes,
    funnelsRes,
    automationsRes,
    heatmapsRes,
    replaysRes,
    eventsRes,
    aiAnalysesRes,
  ] = await Promise.all([
    // Websites owned by this user
    sql<[{ c: string }]>`
      SELECT COUNT(*)::int AS c
      FROM websites
      WHERE user_id = ${userId}::uuid
    `,

    // Funnels owned by this user (across all their websites)
    sql<[{ c: string }]>`
      SELECT COUNT(*)::int AS c
      FROM funnels
      WHERE user_id = ${userId}::uuid
    `,

    // Automations owned by this user
    sql<[{ c: string }]>`
      SELECT COUNT(*)::int AS c
      FROM automations
      WHERE user_id = ${userId}::uuid
    `,

    // Distinct heatmap pages (website_id + page_path) across user's websites
    sql<[{ c: string }]>`
      SELECT COUNT(*)::int AS c
      FROM (
        SELECT DISTINCT website_id, page_path
        FROM heatmap_points
        WHERE website_id IN (
          SELECT id FROM websites WHERE user_id = ${userId}::uuid
        )
      ) sub
    `,

    // Distinct sessions recorded this calendar month.
    // session_replays.website_id is stored as either site_id (text) or UUID string —
    // match both so counts are accurate regardless of which form was written.
    sql<[{ c: string }]>`
      SELECT COUNT(DISTINCT session_id)::int AS c
      FROM session_replays
      WHERE website_id IN (
        SELECT site_id FROM websites WHERE user_id = ${userId}::uuid
        UNION
        SELECT id::text FROM websites WHERE user_id = ${userId}::uuid
      )
      AND sequence = 0
      AND timestamp >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    `,

    // Analytics events fired this calendar month across user's websites
    sql<[{ c: string }]>`
      SELECT COUNT(*)::int AS c
      FROM analytics_events
      WHERE website_id IN (
        SELECT site_id FROM websites WHERE user_id = ${userId}::uuid
      )
      AND occurred_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    `,

    // AI analyses run by this user this calendar month
    sql<[{ c: string }]>`
      SELECT COUNT(*)::int AS c
      FROM ai_queries
      WHERE user_id = ${userId}::uuid
      AND status = 'success'
      AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    `,
  ]);

  const n = (rows: [{ c: string }]) => Math.max(0, parseInt(rows[0]?.c ?? "0", 10) || 0);

  return {
    websites: n(websitesRes),
    funnels: n(funnelsRes),
    automations: n(automationsRes),
    heatmaps: n(heatmapsRes),
    replays: n(replaysRes),
    monthly_events: n(eventsRes),
    ai_analyses: n(aiAnalysesRes),
  };
}
