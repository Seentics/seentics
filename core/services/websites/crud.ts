import { and, asc, eq } from "drizzle-orm";
import {
  analyticsEvents,
  automations,
  db,
  funnels,
  goals,
  websiteMembers,
  websites,
} from "../../db";
import type { CreateWebsiteBody } from "../../lib/api-types";
import { newSiteId, newTrackingId, newVerificationToken } from "../../lib/ids";
import { resolveWebsiteIds } from "../../lib/website-resolve";
import { assertWebsiteAccess } from "./access";
import { emptySiteStats, mapWebsiteRow, normalizeUrl, siteStats, siteStatsBatch } from "./shared";

export async function listForUser(userId: string) {
  const rows = await db
    .select()
    .from(websites)
    .where(eq(websites.userId, userId))
    .orderBy(asc(websites.createdAt));
  // One grouped stats query for all sites instead of 2 sequential queries per site.
  const stats = await siteStatsBatch(rows.map((w) => w.siteId));
  const out = rows.map((w) => mapWebsiteRow(w, stats.get(w.siteId) ?? emptySiteStats()));
  return { data: out };
}

export async function createForUser(userId: string, body: CreateWebsiteBody) {
  const host = normalizeUrl(body.url);
  const siteId = newSiteId();
  const trk = newTrackingId();
  const token = newVerificationToken();
  const [w] = await db
    .insert(websites)
    .values({
      siteId,
      userId,
      name: body.name.trim(),
      url: host,
      trackingId: trk,
      verificationToken: token,
      replayEnabled: true,
      replaySamplingRate: 1,
    })
    .returning();
  await db.insert(websiteMembers).values({
    websiteId: w!.id,
    userId,
    role: "owner",
  });
  return { data: { website: mapWebsiteRow(w!, await siteStats(w!.siteId)) } };
}

export async function getForUser(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [w] = await db.select().from(websites).where(eq(websites.id, uuidStr)).limit(1);
  if (!w) return null;
  return { data: mapWebsiteRow(w, await siteStats(w.siteId)) };
}

export async function updateForUser(
  userId: string,
  websiteParam: string,
  patch: Partial<{
    name: string;
    url: string;
    is_active: boolean;
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
  }>,
) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [w] = await db
    .update(websites)
    .set({
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.url != null ? { url: normalizeUrl(patch.url) } : {}),
      ...(patch.is_active != null ? { isActive: patch.is_active } : {}),
      ...(patch.automation_enabled != null ? { automationEnabled: patch.automation_enabled } : {}),
      ...(patch.funnel_enabled != null ? { funnelEnabled: patch.funnel_enabled } : {}),
      ...(patch.heatmap_enabled != null ? { heatmapEnabled: patch.heatmap_enabled } : {}),
      ...(patch.heatmap_include_patterns !== undefined
        ? { heatmapIncludePatterns: patch.heatmap_include_patterns }
        : {}),
      ...(patch.heatmap_exclude_patterns !== undefined
        ? { heatmapExcludePatterns: patch.heatmap_exclude_patterns }
        : {}),
      ...(patch.heatmap_layout_enabled != null
        ? { heatmapLayoutEnabled: patch.heatmap_layout_enabled }
        : {}),
      ...(patch.replay_enabled != null ? { replayEnabled: patch.replay_enabled } : {}),
      ...(patch.replay_sampling_rate != null ? { replaySamplingRate: patch.replay_sampling_rate } : {}),
      ...(patch.replay_include_patterns !== undefined
        ? { replayIncludePatterns: patch.replay_include_patterns }
        : {}),
      ...(patch.replay_exclude_patterns !== undefined
        ? { replayExcludePatterns: patch.replay_exclude_patterns }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(websites.id, uuidStr))
    .returning();
  if (!w) return null;
  return { data: mapWebsiteRow(w, await siteStats(w.siteId)) };
}

export async function deleteForUser(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [w] = await db.select().from(websites).where(eq(websites.id, uuidStr)).limit(1);
  if (!w) return false;
  await db.delete(analyticsEvents).where(eq(analyticsEvents.websiteId, w.siteId));
  await db.delete(automations).where(eq(automations.websiteId, uuidStr));
  await db.delete(funnels).where(eq(funnels.websiteId, uuidStr));
  await db.delete(goals).where(eq(goals.websiteId, uuidStr));
  await db.delete(websiteMembers).where(eq(websiteMembers.websiteId, uuidStr));
  await db.delete(websites).where(eq(websites.id, uuidStr));
  return true;
}
