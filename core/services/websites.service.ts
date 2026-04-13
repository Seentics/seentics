import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import {
  analyticsEvents,
  automations,
  db,
  funnels,
  goals,
  users,
  websiteMembers,
  websites,
} from "../db";
import type {
  AddWebsiteMemberBody,
  CreateGoalBody,
  CreateWebsiteBody,
  UpdateGoalPatch,
} from "../lib/api-types";
import { newSiteId, newTrackingId, newVerificationToken } from "../lib/ids";
import { resolveWebsiteIds } from "../lib/website-resolve";

const defaultSettings = () => ({
  allowedOrigins: [] as string[],
  trackingEnabled: true,
  dataRetentionDays: 365,
  useIpAnonymization: false,
  respectDoNotTrack: false,
  allowRawDataExport: false,
});

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) u = `https://${u}`;
  try {
    const p = new URL(u);
    return p.hostname.replace(/^www\./, "");
  } catch {
    throw new Error("invalid website URL format");
  }
}

export async function assertWebsiteAccess(userId: string, websiteParam: string) {
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [m] = await db
    .select({ id: websiteMembers.id })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.userId, userId), eq(websiteMembers.websiteId, uuidStr)))
    .limit(1);
  if (m) return uuidStr;
  const [o] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, uuidStr), eq(websites.userId, userId)))
    .limit(1);
  if (o) return uuidStr;
  const err = new Error("forbidden");
  (err as Error & { status: number }).status = 403;
  throw err;
}

async function siteStats(siteId: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [pv] = await db
    .select({ c: count() })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.websiteSiteId, siteId),
        gte(analyticsEvents.occurredAt, since),
        eq(analyticsEvents.eventType, "pageview"),
      ),
    );
  const [vis] = await db
    .select({ c: sql<number>`count(distinct ${analyticsEvents.visitorId})::int` })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteSiteId, siteId), gte(analyticsEvents.occurredAt, since)));
  return {
    totalPageviews: Number(pv?.c ?? 0),
    uniqueVisitors: Number(vis?.c ?? 0),
    averageSessionDuration: 0,
    bounceRate: 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWebsiteRow(w: typeof websites.$inferSelect, stats: any) {
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

export async function listForUser(userId: string) {
  const rows = await db    .select()
    .from(websites)
    .where(eq(websites.userId, userId))
    .orderBy(asc(websites.createdAt));
  const out = [];
  for (const w of rows) {
    out.push(mapWebsiteRow(w, await siteStats(w.siteId)));
  }
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
  await db.delete(analyticsEvents).where(eq(analyticsEvents.websiteSiteId, w.siteId));
  await db.delete(automations).where(eq(automations.websiteId, uuidStr));
  await db.delete(funnels).where(eq(funnels.websiteId, uuidStr));
  await db.delete(goals).where(eq(goals.websiteId, uuidStr));
  await db.delete(websiteMembers).where(eq(websiteMembers.websiteId, uuidStr));
  await db.delete(websites).where(eq(websites.id, uuidStr));
  return true;
}

export async function listGoals(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.websiteId, uuidStr))
    .orderBy(asc(goals.createdAt));
  return {
    data: rows.map((g) => ({
      id: g.id,
      website_id: g.websiteId,
      name: g.name,
      type: g.type,
      identifier: g.identifier,
      selector: g.selector,
      revenue: g.revenue,
      currency: g.currency,
      created_at: g.createdAt.toISOString(),
      updated_at: g.updatedAt.toISOString(),
    })),
  };
}

export async function createGoal(userId: string, websiteParam: string, body: CreateGoalBody) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [g] = await db
    .insert(goals)
    .values({
      websiteId: uuidStr,
      name: body.name,
      type: body.type,
      identifier: body.identifier,
      selector: body.selector ?? null,
    })
    .returning();
  return { data: g };
}

export async function updateGoal(
  userId: string,
  websiteParam: string,
  goalId: string,
  body: UpdateGoalPatch,
) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [g] = await db
    .update(goals)
    .set({
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.type != null ? { type: body.type } : {}),
      ...(body.identifier != null ? { identifier: body.identifier } : {}),
      ...(body.selector !== undefined ? { selector: body.selector } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(goals.id, goalId), eq(goals.websiteId, uuidStr)))
    .returning();
  return g ? { data: g } : null;
}

export async function deleteGoal(userId: string, websiteParam: string, goalId: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.websiteId, uuidStr)));
}

export async function listMembers(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const rows = await db
    .select({
      id: websiteMembers.id,
      websiteId: websiteMembers.websiteId,
      userId: websiteMembers.userId,
      role: websiteMembers.role,
      createdAt: websiteMembers.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(websiteMembers)
    .innerJoin(users, eq(users.id, websiteMembers.userId))
    .where(eq(websiteMembers.websiteId, uuidStr))
    .orderBy(asc(websiteMembers.createdAt));

  return {
    data: rows.map((m) => ({
      id: m.id,
      website_id: m.websiteId,
      user_id: m.userId,
      role: m.role,
      created_at: m.createdAt.toISOString(),
      user_name: m.userName,
      user_email: m.userEmail,
    })),
  };
}

export async function addMember(userId: string, websiteParam: string, body: AddWebsiteMemberBody) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.trim().toLowerCase()))
    .limit(1);
  if (!target) throw new Error("user not found");
  const [existing] = await db
    .select()
    .from(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, uuidStr), eq(websiteMembers.userId, target.id)))
    .limit(1);
  if (existing) return { data: existing };
  const [m] = await db
    .insert(websiteMembers)
    .values({
      websiteId: uuidStr,
      userId: target.id,
      role: body.role ?? "member",
    })
    .returning();
  return { data: m };
}

export async function removeMember(userId: string, websiteParam: string, memberUserId: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db
    .delete(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, uuidStr), eq(websiteMembers.userId, memberUserId)));
}

export async function updateMemberRole(
  userId: string,
  websiteParam: string,
  memberUserId: string,
  role: string,
) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  await db
    .update(websiteMembers)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(websiteMembers.websiteId, uuidStr), eq(websiteMembers.userId, memberUserId)));
}

export async function getMyRole(userId: string, websiteParam: string) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const [m] = await db
    .select({ role: websiteMembers.role })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, uuidStr), eq(websiteMembers.userId, userId)))
    .limit(1);
  if (m) return { data: { role: m.role } };
  const [w] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, uuidStr), eq(websites.userId, userId)))
    .limit(1);
  if (w) return { data: { role: "owner" } };
  return { data: { role: "viewer" } };
}

export async function toggleShare(userId: string, websiteParam: string, enabled: boolean) {
  await assertWebsiteAccess(userId, websiteParam);
  const { uuidStr } = await resolveWebsiteIds(websiteParam);
  const publicShareId = enabled ? newSiteId().slice(0, 16) : null;
  await db.update(websites).set({ publicShareId, updatedAt: new Date() }).where(eq(websites.id, uuidStr));
  return { data: { public_share_id: publicShareId } };
}
