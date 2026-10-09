import type { AppConfig } from "../../../config";
import { sql } from "../../../db";
import { MemoryCache } from "../../../platform/cache/memory-cache";
import type { TrackerGoal, WebsiteTrackerRow } from "../interfaces";


const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let websiteResolveCache: MemoryCache<WebsiteTrackerRow | null> | null = null;
let websiteResolveCacheTtlMs = 180_000;

/** Call once at process start (see `index.ts`) so lookups reuse TTL-cached rows (including “not found”). */
export function configureTrackerWebsiteCache(cfg: AppConfig): void {
  if (!cfg.trackerCache.enabled) {
    websiteResolveCache = null;
    return;
  }
  websiteResolveCache = new MemoryCache<WebsiteTrackerRow | null>(cfg.trackerCache.maxEntries);
  websiteResolveCacheTtlMs = cfg.trackerCache.websiteTtlMs;
}

/** Website rows are cached under either UUID or tracking id, so invalidate all aliases. */
export function clearTrackerWebsiteCache(): void {
  websiteResolveCache?.clear();
}

/**
 * Load a website by the id the tracker sends: either `websites.id` (UUID) or `websites.tracking_id`.
 * Uses an in-memory TTL cache when `configureTrackerWebsiteCache` ran with cache enabled.
 *
 * A site that belongs to a client gets the client's switches applied here, on top of its
 * own: a client that is not `active`, or has `analytics` off, deactivates the site, and a
 * feature off for the client is off for every one of its sites. This row is what both the
 * tracker's config and ingest's drop rules read, so this is the one place it has to happen.
 */
export async function resolveWebsiteForTracker(
  websiteParam: string,
): Promise<WebsiteTrackerRow | null> {
  const p = websiteParam.trim();
  if (!p) return null;

  if (websiteResolveCache) {
    if (Math.random() < 0.05) websiteResolveCache.sweepExpired();
    const hit = websiteResolveCache.get(p);
    if (hit !== undefined) return hit;
  }

  const rows = uuidRe.test(p)
    ? await sql<WebsiteTrackerRow[]>`
        SELECT
          websites.id::text AS id,
          websites.user_id::text AS user_id,
          websites.url,
          websites.is_active
            AND COALESCE(client.status, 'active') = 'active'
            AND COALESCE((client.features_enabled->>'analytics')::boolean, true) AS is_active,
          websites.funnel_enabled
            AND COALESCE((client.features_enabled->>'funnels')::boolean, true) AS funnel_enabled,
          websites.heatmap_enabled
            AND COALESCE((client.features_enabled->>'heatmaps')::boolean, true) AS heatmap_enabled,
          websites.heatmap_include_patterns,
          websites.heatmap_exclude_patterns,
          websites.heatmap_layout_enabled,
          websites.replay_enabled
            AND COALESCE((client.features_enabled->>'replays')::boolean, true) AS replay_enabled,
          websites.replay_sampling_rate,
          websites.replay_include_patterns,
          websites.replay_exclude_patterns,
          websites.mask_all_text,
          websites.mask_text_patterns,
          websites.automation_enabled
            AND COALESCE((client.features_enabled->>'automations')::boolean, true) AS automation_enabled,
          websites.errors_enabled
            AND COALESCE((client.features_enabled->>'errors')::boolean, true) AS errors_enabled,
          COALESCE(privacy.respect_dnt, false) AS respect_dnt,
          COALESCE(privacy.consent_mode, 'cookieless') AS consent_mode
        FROM websites
        LEFT JOIN website_privacy_settings privacy ON privacy.site_id = websites.id::text
        LEFT JOIN clients client ON client.id = websites.client_id
        WHERE websites.id = ${p}::uuid
        LIMIT 1
      `
    : await sql<WebsiteTrackerRow[]>`
        SELECT
          websites.id::text AS id,
          websites.user_id::text AS user_id,
          websites.url,
          websites.is_active
            AND COALESCE(client.status, 'active') = 'active'
            AND COALESCE((client.features_enabled->>'analytics')::boolean, true) AS is_active,
          websites.funnel_enabled
            AND COALESCE((client.features_enabled->>'funnels')::boolean, true) AS funnel_enabled,
          websites.heatmap_enabled
            AND COALESCE((client.features_enabled->>'heatmaps')::boolean, true) AS heatmap_enabled,
          websites.heatmap_include_patterns,
          websites.heatmap_exclude_patterns,
          websites.heatmap_layout_enabled,
          websites.replay_enabled
            AND COALESCE((client.features_enabled->>'replays')::boolean, true) AS replay_enabled,
          websites.replay_sampling_rate,
          websites.replay_include_patterns,
          websites.replay_exclude_patterns,
          websites.mask_all_text,
          websites.mask_text_patterns,
          websites.automation_enabled
            AND COALESCE((client.features_enabled->>'automations')::boolean, true) AS automation_enabled,
          websites.errors_enabled
            AND COALESCE((client.features_enabled->>'errors')::boolean, true) AS errors_enabled,
          COALESCE(privacy.respect_dnt, false) AS respect_dnt,
          COALESCE(privacy.consent_mode, 'cookieless') AS consent_mode
        FROM websites
        LEFT JOIN website_privacy_settings privacy ON privacy.site_id = websites.id::text
        LEFT JOIN clients client ON client.id = websites.client_id
        WHERE websites.tracking_id = ${p}
        LIMIT 1
      `;

  const row = rows[0] ?? null;
  if (websiteResolveCache) {
    websiteResolveCache.set(p, row, websiteResolveCacheTtlMs);
  }
  return row;
}


export async function listTrackerGoals(websiteId: string): Promise<TrackerGoal[]> {
  return sql<TrackerGoal[]>`
    SELECT id::text AS id, identifier AS name, name AS label, type,
           CASE WHEN type = 'event' AND btrim(coalesce(selector, '')) <> '' THEN selector END AS selector
    FROM goals
    WHERE website_id = ${websiteId}::uuid
    ORDER BY created_at ASC
  `;
}

export async function buildPublicTrackerConfig(
  w: WebsiteTrackerRow,
  goals: TrackerGoal[],
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    website_id: w.id,
    // Every feature switch the tracker acts on. A feature switched off is not loaded or
    // run in the page at all, and ingest drops anything that arrives for it anyway.
    funnel_enabled: w.funnel_enabled,
    automation_enabled: w.automation_enabled,
    errors_enabled: w.errors_enabled,
    goals: goals.map((g) => ({ id: g.id, name: g.name, label: g.label ?? g.name, type: g.type ?? 'event', selector: g.selector ?? null })),
    replay_enabled: w.replay_enabled,
    replay_sampling_rate: w.replay_sampling_rate,
    replay_include_patterns: w.replay_include_patterns,
    replay_exclude_patterns: w.replay_exclude_patterns,
    // Text masking covers recordings and heatmap snapshots alike: both carry page text.
    mask_all_text: w.mask_all_text,
    mask_text_patterns: w.mask_text_patterns,
    heatmap_enabled: w.heatmap_enabled,
    heatmap_layout_enabled: w.heatmap_layout_enabled,
    respect_dnt: w.respect_dnt,
    consent_mode: w.consent_mode,
  };
  if (w.heatmap_include_patterns) {
    out.heatmap_include_patterns = w.heatmap_include_patterns;
  }
  if (w.heatmap_exclude_patterns) {
    out.heatmap_exclude_patterns = w.heatmap_exclude_patterns;
  }
  return out;
}
