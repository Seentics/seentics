import type { AiRepository } from "../interfaces/ai-repository.interface";

/**
 * The reads that have no typed port yet, over fixed statements.
 *
 * Automations, heatmaps and recordings keep their CRUD behind their own routes and
 * expose nothing another module can call, and funnel definitions have no read port (their
 * figures do — see `funnel-reads.ts`), so these go through `runGuarded` — the
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

    automations: (websiteId: string) =>
      rows(
        `SELECT id, name, status, definition, created_at
           FROM automations
          WHERE website_id = $1
          ORDER BY created_at DESC
          LIMIT 50`,
        websiteId,
      ),

    /**
     * Pages with heatmap data over the last `days` days, each with its headline: clicks, page
     * views (one scroll summary per view) and the median scroll stop — the deepest point at least
     * half the page views reached, as % of page height. Raw stored paths, unmerged.
     */
    heatmapPages: (websiteId: string, days: number) => {
      const window = Math.min(Math.max(1, Math.trunc(days) || 30), 366) - 1;
      return rows(
        `WITH pts AS (
           SELECT page_path, event_type, y_percent, intensity, last_updated
             FROM heatmap_points
            WHERE website_id = $1
              AND day >= (now() AT TIME ZONE 'UTC')::date - ${window}
         ), depth AS (
           SELECT page_path, y_percent AS depth, sum(intensity) AS n
             FROM pts WHERE event_type = 'scroll'
            GROUP BY page_path, y_percent
         ), reach AS (
           SELECT page_path, depth,
                  sum(n) OVER (PARTITION BY page_path ORDER BY depth DESC) AS reached,
                  sum(n) OVER (PARTITION BY page_path) AS views
             FROM depth
         ), scroll AS (
           SELECT page_path, max(views) AS page_views,
                  max(depth) FILTER (WHERE reached * 2 >= views) AS median_scroll_stop_pct
             FROM reach GROUP BY page_path
         ), totals AS (
           SELECT page_path,
                  COALESCE(sum(intensity) FILTER (WHERE event_type = 'click'), 0) AS clicks,
                  max(last_updated) AS last_seen
             FROM pts GROUP BY page_path
         )
         SELECT t.page_path, t.clicks::int AS clicks, COALESCE(s.page_views, 0)::int AS page_views,
                s.median_scroll_stop_pct, t.last_seen
           FROM totals t LEFT JOIN scroll s USING (page_path)
          ORDER BY t.clicks + COALESCE(s.page_views, 0) DESC
          LIMIT 50`,
        websiteId,
      );
    },

    recentSessions: (websiteId: string, limit: number) =>
      rows(
        // Aliased to the names the tool's links block reads. `sequence = 0` is the one metadata
        // row per session; the column names before this matched no column in the table.
        `SELECT session_id, timestamp AS started_at, duration_seconds, pages_viewed AS page_count,
                device AS device_type, browser, country, has_errors, has_rage_clicks
           FROM session_replays
          WHERE website_id = $1 AND sequence = 0
          ORDER BY timestamp DESC
          LIMIT ${Math.min(Math.max(1, Math.trunc(limit) || 10), 50)}`,
        websiteId,
      ),
  };
}
