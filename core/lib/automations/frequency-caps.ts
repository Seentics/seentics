/**
 * Frequency cap helpers — read / write automation_impressions.
 */

import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db, automationImpressions } from '../../db';

export interface ImpressionMeta {
  automationId: string;
  anonymousId: string;
  userId?: string | null;
  websiteId: string;
  sessionId: string;
  variant?: string | null;
}

export async function recordImpression(meta: ImpressionMeta): Promise<void> {
  await db.insert(automationImpressions).values({
    automationId: meta.automationId,
    anonymousId:  meta.anonymousId,
    userId:       meta.userId ?? null,
    websiteId:    meta.websiteId,
    sessionId:    meta.sessionId,
    variant:      meta.variant ?? null,
  });
}

export async function countLifetime(automationId: string, anonymousId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(automationImpressions)
    .where(and(
      eq(automationImpressions.automationId, automationId),
      eq(automationImpressions.anonymousId, anonymousId),
    ));
  return row?.n ?? 0;
}

export async function countSession(automationId: string, sessionId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(automationImpressions)
    .where(and(
      eq(automationImpressions.automationId, automationId),
      eq(automationImpressions.sessionId, sessionId),
    ));
  return row?.n ?? 0;
}

export async function countWithinDays(
  automationId: string,
  anonymousId: string,
  days: number,
): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [row] = await db
    .select({ n: count() })
    .from(automationImpressions)
    .where(and(
      eq(automationImpressions.automationId, automationId),
      eq(automationImpressions.anonymousId, anonymousId),
      gte(automationImpressions.shownAt, since),
    ));
  return row?.n ?? 0;
}

export interface FrequencyCapSpec {
  maxPerSession?: number;
  maxPerUser?: number;
  cooldownDays?: number;
}

export async function isFrequencyCapped(
  automationId: string,
  anonymousId: string,
  sessionId: string,
  caps: FrequencyCapSpec,
): Promise<boolean> {
  if (caps.maxPerSession != null) {
    const n = await countSession(automationId, sessionId);
    if (n >= caps.maxPerSession) return true;
  }
  if (caps.maxPerUser != null) {
    const n = await countLifetime(automationId, anonymousId);
    if (n >= caps.maxPerUser) return true;
  }
  if (caps.cooldownDays != null) {
    const n = await countWithinDays(automationId, anonymousId, caps.cooldownDays);
    if (n > 0) return true;
  }
  return false;
}
