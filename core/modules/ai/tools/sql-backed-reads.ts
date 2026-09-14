import type { AiRepository } from "../interfaces/ai-repository.interface";

/**
 * The reads that have no typed port yet, over fixed statements.
 *
 * Funnels, automations, heatmaps and recordings keep their CRUD behind their own routes
 * and expose nothing another module can call, so these go through `runGuarded` — the
 * same read-only, statement-timed, `$1`-bound execution the SQL path uses.
 *
 * The crucial difference from that path: **these statements are written here, not by a
 * model.** Nothing the user or the model says reaches the SQL. The only value that
 * varies is the bound website id, which comes from the authenticated request. So the
 * generated-SQL guard is not needed for them — there is nothing generated to guard.
 *
 * Each of these should become a typed port on the module that owns the data. Until then
 * this keeps the tool surface complete rather than leaving the agent unable to answer
 * "what automations do I have", which is a question it obviously should answer.
 */
export function sqlBackedReads(repo: AiRepository) {
  const rows = (sql: string, websiteId: string) => repo.runGuarded(sql, websiteId);

  return {
    funnels: (websiteId: string) =>
      rows(
        `SELECT id, name, description, is_active, steps, created_at
           FROM funnels
          WHERE website_id = $1
          ORDER BY created_at DESC
          LIMIT 50`,
        websiteId,
      ),

    /**
     * Step-by-step counts for one funnel.
     *
     * `funnelId` is a model-supplied value, so it is *not* interpolated: the statement
     * filters on the website and the caller matches the funnel afterwards. Binding a
     * second parameter would be better, and is what a typed port will do.
     */
    funnelPerformance: async (websiteId: string, funnelId: string) => {
      const all = await rows(
        `SELECT id, name, steps
           FROM funnels
          WHERE website_id = $1
          LIMIT 50`,
        websiteId,
      );
      return all.filter((f) => String(f.id) === funnelId);
    },

    automations: (websiteId: string) =>
      rows(
        `SELECT id, name, status, definition, created_at
           FROM automations
          WHERE website_id = $1
          ORDER BY created_at DESC
          LIMIT 50`,
        websiteId,
      ),

    heatmapPages: (websiteId: string) =>
      rows(
        `SELECT page_path,
                sum(intensity) AS interactions,
                max(last_updated) AS last_seen
           FROM heatmap_points
          WHERE website_id = $1
          GROUP BY page_path
          ORDER BY interactions DESC
          LIMIT 50`,
        websiteId,
      ),

    recentSessions: (websiteId: string, limit: number) =>
      rows(
        `SELECT session_id, started_at, duration_seconds, page_count,
                device_type, browser, country, has_errors, has_rage_clicks
           FROM session_replays
          WHERE website_id = $1
          ORDER BY started_at DESC
          LIMIT ${Math.min(Math.max(1, Math.trunc(limit) || 10), 50)}`,
        websiteId,
      ),
  };
}
