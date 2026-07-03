/**
 * Server-side automation evaluation.
 * Called by POST /tracker/automations/evaluate (no auth — tracker origin validated upstream).
 *
 * Flow:
 *  1. Load active automations for the website (sorted by priority ASC)
 *  2. For each: match trigger type → evaluate conditions → check frequency caps → pick A/B variant
 *  3. Dispatch webhook actions async (fire-and-forget)
 *  4. Record impression
 *  5. Return client-side action payloads
 */

import { and, asc, eq, sql as rawSql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { automationEvents, automationImpressions, automations, db, userProfiles } from '../db';
import { log } from '../lib/logger';
import type { Conditions } from '../lib/automations/condition-evaluator';
import { evaluateConditions } from '../lib/automations/condition-evaluator';
import {
  getImpressionStats,
  isCappedFromStats,
  recordImpressions,
  capsRequireLookup,
  type FrequencyCapSpec,
  type ImpressionMeta,
} from '../lib/automations/frequency-caps';
import { executeWebhook, type WebhookAction } from '../lib/automations/webhook-executor';
import { renderTemplateDeep } from '../lib/automations/template-engine';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EvaluateRequest {
  websiteId: string;
  anonymousId: string;
  userId?: string | null;
  sessionId: string;
  trigger: {
    type: string;
    [key: string]: unknown;
  };
  context: Record<string, unknown>;
}

export interface ClientAction {
  type: string;
  automation_id: string;
  variant?: string | null;
  run_id: string;
  [key: string]: unknown;
}

export interface EvaluateResult {
  matched: number;
  actions: ClientAction[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AutomationDef = {
  trigger?: { type?: string; [k: string]: unknown };
  conditions?: Conditions;
  actions?: Array<{ type: string; [k: string]: unknown }>;
  frequency?: FrequencyCapSpec;
  abTest?: {
    enabled?: boolean;
    variants?: Array<{ id: string; weight?: number; [k: string]: unknown }>;
  };
};

function castDef(raw: Record<string, unknown>): AutomationDef {
  return raw as AutomationDef;
}

function triggerMatches(defTrigger: AutomationDef['trigger'], incoming: EvaluateRequest['trigger']): boolean {
  if (!defTrigger?.type) return false;
  return defTrigger.type === incoming.type;
}

function pickVariant(abTest: AutomationDef['abTest']): string | null {
  if (!abTest?.enabled || !abTest.variants?.length) return null;
  const variants = abTest.variants;
  const totalWeight = variants.reduce((s, v) => s + (v.weight ?? 1), 0);
  let roll = Math.random() * totalWeight;
  for (const v of variants) {
    roll -= (v.weight ?? 1);
    if (roll <= 0) return v.id;
  }
  return variants[variants.length - 1]?.id ?? null;
}

async function loadUserProfile(websiteId: string, anonymousId: string): Promise<Record<string, unknown>> {
  try {
    const [row] = await db
      .select()
      .from(userProfiles)
      .where(and(eq(userProfiles.websiteId, websiteId), eq(userProfiles.anonymousId, anonymousId)))
      .limit(1);
    if (!row) return {};
    return {
      visitCount:     row.visitCount,
      totalPageViews: row.totalPageViews,
      country:        row.country,
      city:           row.city,
      device:         row.device,
      browser:        row.browser,
      firstSeenAt:    row.firstSeenAt?.toISOString(),
      lastSeenAt:     row.lastSeenAt?.toISOString(),
      ...(row.properties as Record<string, unknown>),
      ...(row.computed  as Record<string, unknown>),
    };
  } catch {
    return {};
  }
}

async function logServerRun(
  automationId: string,
  runId: string,
  anonymousId: string,
  sessionId: string,
  triggerType: string,
  pageUrl: string | undefined,
): Promise<void> {
  try {
    await db.insert(automationEvents).values({
      automationId,
      runId,
      recordType:   'server_run',
      triggerEvent: triggerType,
      status:       'running',
      visitorId:    anonymousId,
      sessionId,
      pageUrl:      pageUrl ?? null,
    });
  } catch (err) {
    log.warn({ msg: 'auto_event_log_failed', automationId, err });
  }
}

async function logActionResult(
  automationId: string,
  runId: string,
  actionKey: string,
  status: 'success' | 'failed',
  durationMs: number,
  errorMessage?: string,
): Promise<void> {
  try {
    await db.insert(automationEvents).values({
      automationId,
      runId,
      recordType: 'action',
      actionKey,
      status,
      durationMs,
      errorMessage: errorMessage ?? null,
    });
  } catch {
    // best-effort
  }
}

// ─── Main evaluate function ───────────────────────────────────────────────────

export async function evaluate(req: EvaluateRequest): Promise<EvaluateResult> {
  const { websiteId, anonymousId, userId, sessionId, trigger, context } = req;

  // Load user profile facts to merge into condition context
  const profileFacts = await loadUserProfile(websiteId, anonymousId);
  const fullContext: Record<string, unknown> = {
    ...profileFacts,
    ...context,
    user: { ...(profileFacts as object), ...(context.user as object ?? {}) },
    session: { id: sessionId, ...(context.session as object ?? {}) },
    trigger,
  };

  // Load active automations sorted by priority
  const rows = await db
    .select()
    .from(automations)
    .where(and(eq(automations.websiteId, websiteId), eq(automations.isActive, true)))
    .orderBy(asc(automations.priority));

  // First pass (no DB): narrow to automations whose trigger + conditions match.
  // Cache the parsed definition so we don't castDef twice per automation.
  const candidates: { auto: (typeof rows)[number]; def: ReturnType<typeof castDef>; caps: FrequencyCapSpec }[] = [];
  for (const auto of rows) {
    const def = castDef(auto.definition);
    if (!triggerMatches(def.trigger, trigger)) continue;
    if (!evaluateConditions(def.conditions ?? null, fullContext)) continue;
    candidates.push({ auto, def, caps: def.frequency ?? {} });
  }

  // One batched impression-stats query for every candidate that has a cap needing a
  // lookup — replaces up to 3 sequential COUNT queries PER automation.
  const cappedIds = candidates.filter((c) => capsRequireLookup(c.caps)).map((c) => c.auto.id);
  const stats = await getImpressionStats(cappedIds, anonymousId, sessionId);

  const clientActions: ClientAction[] = [];
  const impressions: ImpressionMeta[] = [];
  let matched = 0;

  for (const { auto, def, caps } of candidates) {
    if (isCappedFromStats(stats.get(auto.id), caps)) continue;

    matched++;
    const runId   = randomUUID();
    const variant = pickVariant(def.abTest);

    // Log server run (async, best-effort)
    void logServerRun(auto.id, runId, anonymousId, sessionId, trigger.type, context.page as string | undefined);

    // Buffer the impression; all matched impressions are inserted in one round trip below.
    impressions.push({ automationId: auto.id, anonymousId, userId, websiteId, sessionId, variant });

    // Process actions
    for (let i = 0; i < (def.actions ?? []).length; i++) {
      const action = def.actions![i]!;
      const actionKey = `${action.type}_${i}`;

      if (action.type === 'webhook') {
        const t0 = Date.now();
        void executeWebhook(auto.id, action as unknown as WebhookAction, fullContext, runId)
          .then(() => logActionResult(auto.id, runId, actionKey, 'success', Date.now() - t0))
          .catch((err: unknown) => {
            log.warn({ msg: 'webhook_action_error', automationId: auto.id, err });
            void logActionResult(auto.id, runId, actionKey, 'failed', Date.now() - t0, String(err));
          });
        continue;
      }

      // Client-side actions: render templates and return to tracker
      const rendered = renderTemplateDeep(action, fullContext) as Record<string, unknown>;
      clientActions.push({
        ...rendered,
        type:          action.type,
        automation_id: auto.id,
        variant,
        run_id:        runId,
      });

      void logActionResult(auto.id, runId, actionKey, 'success', 0);
    }
  }

  // Persist all impressions from this evaluate in a single insert.
  if (impressions.length > 0) await recordImpressions(impressions);

  return { matched, actions: clientActions };
}

// ─── User profile upsert (called from ingest when identify events arrive) ─────

export interface IdentifyPayload {
  websiteId: string;
  anonymousId: string;
  userId?: string | null;
  properties?: Record<string, unknown>;
  meta?: {
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
  };
}

export async function upsertUserProfile(payload: IdentifyPayload): Promise<void> {
  const { websiteId, anonymousId, userId, properties = {}, meta = {} } = payload;
  try {
    await db
      .insert(userProfiles)
      .values({
        websiteId,
        anonymousId,
        userId: userId ?? null,
        properties,
        country: meta.country ?? null,
        city:    meta.city    ?? null,
        device:  meta.device  ?? null,
        browser: meta.browser ?? null,
        firstSeenAt: new Date(),
        lastSeenAt:  new Date(),
      })
      .onConflictDoUpdate({
        target: [userProfiles.websiteId, userProfiles.anonymousId],
        set: {
          userId:       userId ?? null,
          properties,
          country:      meta.country ?? null,
          city:         meta.city    ?? null,
          device:       meta.device  ?? null,
          browser:      meta.browser ?? null,
          lastSeenAt:   new Date(),
          visitCount:   rawSql`${userProfiles.visitCount} + 1`,
          updatedAt:    new Date(),
        },
      });
  } catch (err) {
    log.warn({ msg: 'upsert_user_profile_failed', anonymousId, err });
  }
}
