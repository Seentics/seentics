import { sql } from "../db";

export type WebsiteTrackerRow = {
  id: string;
  site_id: string;
  user_id: string;
  url: string;
  is_active: boolean;
  funnel_enabled: boolean;
  heatmap_enabled: boolean;
  heatmap_include_patterns: string | null;
  heatmap_exclude_patterns: string | null;
  heatmap_layout_enabled: boolean;
  replay_enabled: boolean;
  replay_sampling_rate: number;
  replay_include_patterns: string | null;
  replay_exclude_patterns: string | null;
  automation_enabled: boolean;
};

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getWebsiteTrackerRow(
  websiteParam: string,
): Promise<WebsiteTrackerRow | null> {
  const p = websiteParam.trim();
  if (!p) return null;

  const rows = uuidRe.test(p)
    ? await sql<WebsiteTrackerRow[]>`
        SELECT
          id::text,
          site_id,
          user_id::text,
          url,
          is_active,
          funnel_enabled,
          heatmap_enabled,
          heatmap_include_patterns,
          heatmap_exclude_patterns,
          heatmap_layout_enabled,
          replay_enabled,
          replay_sampling_rate,
          replay_include_patterns,
          replay_exclude_patterns,
          automation_enabled
        FROM websites
        WHERE id = ${p}::uuid LIMIT 1
      `
    : await sql<WebsiteTrackerRow[]>`
        SELECT
          id::text,
          site_id,
          user_id::text,
          url,
          is_active,
          funnel_enabled,
          heatmap_enabled,
          heatmap_include_patterns,
          heatmap_exclude_patterns,
          heatmap_layout_enabled,
          replay_enabled,
          replay_sampling_rate,
          replay_include_patterns,
          replay_exclude_patterns,
          automation_enabled
        FROM websites
        WHERE site_id = ${p}
        LIMIT 1
      `;

  return rows[0] ?? null;
}

export type TrackerGoal = { id: string; name: string; selector: string };

export async function listTrackerGoals(websiteUuid: string): Promise<TrackerGoal[]> {
  return sql<TrackerGoal[]>`
    SELECT id::text AS id, identifier AS name, selector AS selector
    FROM goals
    WHERE website_id = ${websiteUuid}::uuid
      AND type = 'event'
      AND selector IS NOT NULL
      AND btrim(selector) <> ''
    ORDER BY created_at ASC
  `;
}

export async function buildPublicTrackerConfig(
  w: WebsiteTrackerRow,
  goals: TrackerGoal[],
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    website_id: w.id,
    funnel_enabled: w.funnel_enabled,
    goals: goals.map((g) => ({ id: g.id, name: g.name, selector: g.selector })),
    replay_enabled: w.replay_enabled,
    replay_sampling_rate: w.replay_sampling_rate,
    replay_include_patterns: w.replay_include_patterns,
    replay_exclude_patterns: w.replay_exclude_patterns,
    heatmap_enabled: w.heatmap_enabled,
    heatmap_layout_enabled: w.heatmap_layout_enabled,
  };
  if (w.heatmap_include_patterns) {
    out.heatmap_include_patterns = w.heatmap_include_patterns;
  }
  if (w.heatmap_exclude_patterns) {
    out.heatmap_exclude_patterns = w.heatmap_exclude_patterns;
  }
  return out;
}
