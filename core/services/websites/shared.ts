import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { analyticsEvents, db, websites } from "../../db";

export type SiteStats = {
  totalPageviews: number;
  uniqueVisitors: number;
  averageSessionDuration: number;
  bounceRate: number;
};

const EMPTY_SITE_STATS: SiteStats = {
  totalPageviews: 0,
  uniqueVisitors: 0,
  averageSessionDuration: 0,
  bounceRate: 0,
};

export const defaultSettings = () => ({
  allowedOrigins: [] as string[],
  trackingEnabled: true,
  dataRetentionDays: 365,
  useIpAnonymization: false,
  respectDoNotTrack: false,
  allowRawDataExport: false,
});

export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) u = `https://${u}`;
  try {
    const p = new URL(u);
    return p.hostname.replace(/^www\./, "");
  } catch {
    throw new Error("invalid website URL format");
  }
}

/**
 * 30-day pageviews + unique visitors for MANY sites in ONE grouped query.
 * Replaces calling siteStats() per website (which was 2 sequential queries each).
 * Metric semantics match siteStats exactly: pageviews are event_type='pageview';
 * unique visitors are distinct visitor_id across all events in the window.
 */
export async function siteStatsBatch(siteIds: string[]): Promise<Map<string, SiteStats>> {
  const map = new Map<string, SiteStats>();
  if (siteIds.length === 0) return map;
  const since = new Date(Date.now() - 30 * 86400_000);
  const rows = await db
    .select({
      websiteId: analyticsEvents.websiteId,
      pv: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'pageview')::int`,
      uv: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
    })
    .from(analyticsEvents)
    .where(and(inArray(analyticsEvents.websiteId, siteIds), gte(analyticsEvents.occurredAt, since)))
    .groupBy(analyticsEvents.websiteId);
  for (const r of rows) {
    map.set(r.websiteId, {
      totalPageviews: Number(r.pv ?? 0),
      uniqueVisitors: Number(r.uv ?? 0),
      averageSessionDuration: 0,
      bounceRate: 0,
    });
  }
  return map;
}

export function emptySiteStats(): SiteStats {
  return { ...EMPTY_SITE_STATS };
}

export async function siteStats(siteId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [pv] = await db
    .select({ c: count() })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteId, siteId),
        gte(analyticsEvents.occurredAt, since),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    );
  const [vis] = await db
    .select({ c: sql<number>`count(distinct ${analyticsEvents.visitorId})::int` })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteId, siteId), gte(analyticsEvents.occurredAt, since)));
  return {
    totalPageviews: Number(pv?.c ?? 0),
    uniqueVisitors: Number(vis?.c ?? 0),
    averageSessionDuration: 0,
    bounceRate: 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapWebsiteRow(w: typeof websites.$inferSelect, stats: any) {
  const settings = (w.settingsJson as Record<string, unknown> | null) ?? defaultSettings();
  return {
    id: w.id,
    site_id: w.siteId,
    user_id: w.userId,
    name: w.name,
    url: w.url,
    tracking_id: w.trackingId,
    is_active: w.isActive,
    is_verified: w.isVerified,
    automation_enabled: w.automationEnabled,
    funnel_enabled: w.funnelEnabled,
    heatmap_enabled: w.heatmapEnabled,
    heatmap_include_patterns: w.heatmapIncludePatterns,
    heatmap_exclude_patterns: w.heatmapExcludePatterns,
    heatmap_layout_enabled: w.heatmapLayoutEnabled,
    replay_enabled: w.replayEnabled,
    replay_sampling_rate: w.replaySamplingRate,
    replay_include_patterns: w.replayIncludePatterns,
    replay_exclude_patterns: w.replayExcludePatterns,
    verification_token: w.verificationToken,
    public_share_id: w.publicShareId,
    created_at: w.createdAt.toISOString(),
    updated_at: w.updatedAt.toISOString(),
    settings,
    stats,
  };
}
