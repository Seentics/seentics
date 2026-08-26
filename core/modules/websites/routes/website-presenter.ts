import type { TrafficSummary, Website } from "../interfaces";
import type { WebsiteWithTraffic } from "../services/website.service";

/**
 * Domain model → HTTP response body.
 *
 * The wire format is snake_case with ISO timestamps and a `stats` key; the domain
 * model is camelCase with `Date`s and `traffic`. Keeping the translation in one
 * presenter is what lets the domain model be renamed without breaking clients —
 * and this shape is load-bearing, because the existing web app reads these exact
 * field names.
 */

export type WebsiteResponse = {
  id: string;
  site_id: string;
  user_id: string;
  name: string;
  url: string;
  tracking_id: string;
  is_active: boolean;
  is_verified: boolean;
  automation_enabled: boolean;
  funnel_enabled: boolean;
  heatmap_enabled: boolean;
  heatmap_include_patterns: string | null;
  heatmap_exclude_patterns: string | null;
  heatmap_layout_enabled: boolean;
  replay_enabled: boolean;
  replay_sampling_rate: number;
  replay_include_patterns: string | null;
  replay_exclude_patterns: string | null;
  verification_token: string;
  public_share_id: string | null;
  created_at: string;
  updated_at: string;
  settings: Record<string, unknown>;
  stats: TrafficSummary;
};

/** Zeroed stats, for responses that carry no traffic figures. */
const NO_STATS: TrafficSummary = {
  totalPageviews: 0,
  uniqueVisitors: 0,
  averageSessionDuration: 0,
  bounceRate: 0,
};

export function presentWebsite(
  website: Website | WebsiteWithTraffic,
): WebsiteResponse {
  const stats = "traffic" in website ? website.traffic : NO_STATS;

  return {
    id: website.id,
    site_id: website.siteId,
    user_id: website.ownerId,
    name: website.name,
    url: website.url,
    tracking_id: website.trackingId,
    is_active: website.isActive,
    is_verified: website.isVerified,
    automation_enabled: website.automationEnabled,
    funnel_enabled: website.funnelEnabled,
    heatmap_enabled: website.heatmapEnabled,
    heatmap_include_patterns: website.heatmapIncludePatterns,
    heatmap_exclude_patterns: website.heatmapExcludePatterns,
    heatmap_layout_enabled: website.heatmapLayoutEnabled,
    replay_enabled: website.replayEnabled,
    replay_sampling_rate: website.replaySamplingRate,
    replay_include_patterns: website.replayIncludePatterns,
    replay_exclude_patterns: website.replayExcludePatterns,
    verification_token: website.verificationToken,
    public_share_id: website.publicShareId,
    created_at: website.createdAt.toISOString(),
    updated_at: website.updatedAt.toISOString(),
    settings: website.settings as unknown as Record<string, unknown>,
    stats,
  };
}

export function presentWebsites(
  websites: (Website | WebsiteWithTraffic)[],
): WebsiteResponse[] {
  return websites.map(presentWebsite);
}
