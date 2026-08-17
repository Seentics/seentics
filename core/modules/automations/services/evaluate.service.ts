/**
 * Server-side automation evaluation.
 *
 * Called by POST /tracker/automations/evaluate (no auth — tracker origin validated upstream).
 *
 * Flow:
 *  1. Load active automations for the website (sorted by priority ASC)
 *  2. For each: match trigger type → evaluate conditions → check frequency caps → pick A/B variant
 *  3. Dispatch webhook actions async (fire-and-forget)
 *  4. Record impressions and enqueue `automation.triggered` in one transaction
 *  5. Return client-side action payloads
 */

import { and, eq, sql as rawSql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { automationEvents, db, userProfiles } from '../../../db';
import { InMemoryEventBus, type EventBus, type Unsubscribe } from '../../../infrastructure/events';
import { enqueueEvent } from '../../../infrastructure/outbox';
import { log } from '../../../platform/lib/logger';
import type {
  AutomationEvaluation,
  AutomationEventSubscriber,
  ClientAction,
  EvaluateRequest,
  EvaluateResult,
  IdentifyPayload,
  VisitorProfileWriter,
} from '../interfaces';
import { listActiveAutomationsByPriority } from '../repositories/postgres-automation.repository';
import type { Conditions } from './condition-evaluator';
import { evaluateConditions } from './condition-evaluator';
import {
  getImpressionStats,
  isCappedFromStats,
  recordImpressions,
  capsRequireLookup,
  type FrequencyCapSpec,
  type ImpressionMeta,
} from './frequency-caps';
import { executeWebhook, type WebhookAction } from './webhook-executor';
import { renderTemplateDeep } from './template-engine';

// The request/result contract now lives in `../interfaces` — it is the module's
// public surface, not an implementation detail. Re-exported because the tracker
// route and its tests already import these names from here.
export type { ClientAction, EvaluateRequest, EvaluateResult, IdentifyPayload };

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AutomationDef = {
  trigger?: { type?: string; [k: string]: unknown };
  triggers?: Array<{ type?: string; [k: string]: unknown }>;
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

/** All triggers for a definition — supports new `triggers[]` and legacy single `trigger`. */
function defTriggers(def: AutomationDef): Array<{ type?: string; [k: string]: unknown }> {
  if (Array.isArray(def.triggers) && def.triggers.length) return def.triggers;
  if (def.trigger) return [def.trigger];
  return [];
}

/** An automation matches when ANY of its triggers has the incoming type. */
function triggerMatches(def: AutomationDef, incoming: EvaluateRequest['trigger']): boolean {
  return defTriggers(def).some((t) => !!t?.type && t.type === incoming.type);
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

/** One automation that fired, buffered until the impressions transaction. */
type FiredAutomation = { automationId: string; runId: string; visitorId: string };

// ─── Evaluation service ───────────────────────────────────────────────────────

/**
 * Decides which automations fire for a trigger, and fires them.
 *
 * Two different delivery guarantees are used here on purpose:
 *
 * - `automation.triggered` goes through the **transactional outbox**, enqueued in
 *   the same transaction as the impression it belongs to. An automation firing is
 *   externally visible — it can send a webhook — and it is also what frequency
 *   caps are charged against, so an announcement lost to a crash between COMMIT
 *   and publish would leave a visitor capped for something no consumer ever heard
 *   about. The cost is at-least-once delivery: a consumer must dedupe, and
 *   `runId` is on the payload to be the key it dedupes on.
 * - `automation.action_executed` goes straight to the **bus**. It is one row's
 *   worth of observability per action, already durably recorded in
 *   `automation_events` for the dashboard, and it fires often. Paying for a
 *   transactional write per action to guarantee delivery of a signal whose loss
 *   costs nothing would be the wrong trade.
 *
 * The bus arrives by constructor injection so nothing here knows whether it is
 * in-process or a broker.
 */
export class AutomationEvaluationService
  implements AutomationEvaluation, VisitorProfileWriter, AutomationEventSubscriber
{
  /** Batches seen through `subscribeToIngest`. Diagnostics and tests only. */
  private observedIngestBatches = 0;

  constructor(private readonly eventBus: EventBus) {}

  async evaluate(req: EvaluateRequest): Promise<EvaluateResult> {
    const { websiteId, siteId, anonymousId, userId, sessionId, trigger, context } = req;

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
    const rows = await listActiveAutomationsByPriority(websiteId);

    // First pass (no DB): narrow to automations whose trigger + conditions match.
    // Cache the parsed definition so we don't castDef twice per automation.
    const candidates: { auto: (typeof rows)[number]; def: AutomationDef; caps: FrequencyCapSpec }[] = [];
    for (const auto of rows) {
      const def = castDef(auto.definition);
      if (!triggerMatches(def, trigger)) continue;
      if (!evaluateConditions(def.conditions ?? null, fullContext)) continue;
      candidates.push({ auto, def, caps: def.frequency ?? {} });
    }

    // One batched impression-stats query for every candidate that has a cap needing a
    // lookup — replaces up to 3 sequential COUNT queries PER automation.
    const cappedIds = candidates.filter((c) => capsRequireLookup(c.caps)).map((c) => c.auto.id);
    const stats = await getImpressionStats(cappedIds, anonymousId, sessionId);

    const clientActions: ClientAction[] = [];
    const impressions: ImpressionMeta[] = [];
    const fired: FiredAutomation[] = [];
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
      fired.push({ automationId: auto.id, runId, visitorId: anonymousId });

      // Process actions
      for (let i = 0; i < (def.actions ?? []).length; i++) {
        const action = def.actions![i]!;
        const actionKey = `${action.type}_${i}`;

        if (action.type === 'webhook') {
          const t0 = Date.now();
          void executeWebhook(auto.id, action as unknown as WebhookAction, fullContext, runId)
            .then(() => {
              const ms = Date.now() - t0;
              void logActionResult(auto.id, runId, actionKey, 'success', ms);
              this.announceAction(siteId, auto.id, runId, actionKey, 'success', ms);
            })
            .catch((err: unknown) => {
              const ms = Date.now() - t0;
              log.warn({ msg: 'webhook_action_error', automationId: auto.id, err });
              void logActionResult(auto.id, runId, actionKey, 'failed', ms, String(err));
              this.announceAction(siteId, auto.id, runId, actionKey, 'failed', ms);
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
        this.announceAction(siteId, auto.id, runId, actionKey, 'success', 0);
      }
    }

    // Persist all impressions from this evaluate in a single insert, with the
    // `automation.triggered` events alongside them so the two cannot disagree.
    if (impressions.length > 0) {
      await this.commitImpressions(siteId, impressions, fired);
    }

    return { matched, actions: clientActions };
  }

  /**
   * Impressions and their events, atomically.
   *
   * Wrapped in a transaction only because the outbox rows are in it: on its own the
   * impression insert is a single statement that needs no transaction. The events
   * are enqueued rather than published so the announcement survives the process
   * dying immediately after COMMIT.
   */
  private async commitImpressions(
    siteId: string,
    impressions: ImpressionMeta[],
    fired: FiredAutomation[],
  ): Promise<void> {
    const occurredAt = new Date();
    await db.transaction(async (tx) => {
      await recordImpressions(impressions, tx);
      for (const { automationId, runId, visitorId } of fired) {
        await enqueueEvent(tx, 'automation', automationId, 'automation.triggered', {
          siteId,
          automationId,
          runId,
          // The anonymous id, which is the only visitor identity this path always
          // has — a logged-in `userId` is optional and often absent.
          visitorId,
          occurredAt,
        });
      }
    });
  }

  /**
   * Announce one action's outcome.
   *
   * Fire-and-forget on the bus: the dashboard reads action outcomes from
   * `automation_events`, so this is a signal for live consumers, not the record.
   * A rejected publish is swallowed by the bus itself.
   */
  private announceAction(
    siteId: string,
    automationId: string,
    runId: string,
    actionKey: string,
    status: 'success' | 'failed',
    durationMs: number,
  ): void {
    void this.eventBus.publish('automation.action_executed', {
      siteId,
      automationId,
      runId,
      actionKey,
      status,
      durationMs,
      occurredAt: new Date(),
    });
  }

  // ─── AutomationEventSubscriber ─────────────────────────────────────────────

  /**
   * Observe `analytics.batch_ingested`.
   *
   * The seam for an ingest-driven trigger, deliberately inert. It cannot evaluate
   * anything today: the payload carries a `siteId` and a count, while
   * `EvaluateRequest` needs a visitor, a session and a trigger. Making it fire
   * automations would mean widening that event to carry per-visitor detail, which
   * is a change to when automations run — a behavioural decision for whoever wires
   * `app/bootstrap.ts`, not a side effect of moving files.
   *
   * Nothing subscribes to this yet; see the module's report notes.
   */
  subscribeToIngest(): Unsubscribe {
    return this.eventBus.subscribe('analytics.batch_ingested', () => {
      this.observedIngestBatches++;
    });
  }

  /** Ingest batches observed since construction. Diagnostics and tests only. */
  ingestBatchesObserved(): number {
    return this.observedIngestBatches;
  }

  // ─── VisitorProfileWriter ──────────────────────────────────────────────────

  async upsertUserProfile(payload: IdentifyPayload): Promise<void> {
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
}

// ─── Legacy entry point ───────────────────────────────────────────────────────

/**
 * Instance backing the free functions below.
 *
 * Exists only because `routes/tracker.ts` is still a module-level singleton router
 * mounted directly in `index.ts`: it has no constructor to receive a service
 * through. Its bus therefore has no subscribers, which is survivable precisely
 * because the event that matters — `automation.triggered` — goes through the
 * outbox and is published by the real bus in `app/bootstrap.ts` after commit. The
 * best-effort `automation.action_executed` is the only thing this path drops.
 *
 * Replacing this means turning the tracker routes into a factory and constructing
 * `AutomationEvaluationService` in `app/bootstrap.ts`; both files are owned
 * elsewhere.
 */
let legacyInstance: AutomationEvaluationService | null = null;

function legacyEvaluation(): AutomationEvaluationService {
  legacyInstance ??= new AutomationEvaluationService(new InMemoryEventBus(log));
  return legacyInstance;
}

/** @deprecated Construct `AutomationEvaluationService` and inject it instead. */
export function evaluate(req: EvaluateRequest): Promise<EvaluateResult> {
  return legacyEvaluation().evaluate(req);
}

/** @deprecated Construct `AutomationEvaluationService` and inject it instead. */
export function upsertUserProfile(payload: IdentifyPayload): Promise<void> {
  return legacyEvaluation().upsertUserProfile(payload);
}
