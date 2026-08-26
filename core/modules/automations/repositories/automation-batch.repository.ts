/**
 * The tracker-trigger write path for `automation_events`.
 *
 * Lives in the automations module because it owns that table, but it is called
 * from the ingest queue flusher rather than from anything in here — ingest batches
 * across every module and drains on a timer. Ingest no longer imports it: the call
 * arrives through `AutomationTriggerWriter`, implemented by
 * `services/automation-ingest.service.ts`. Only that adapter may call this function.
 *
 * The category on the logger is still `ingest`, since these lines interleave with
 * the rest of a flush cycle and grouping them by flush is what makes them
 * readable.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { automationEvents, automations, db } from "../../../db";
import type { AutomationTriggerQueued } from "../../../platform/lib/types";
import type { BatchTx } from "../../../infrastructure/idempotency";
import { clampClientTs } from "../../../platform/lib/client-timestamp";
import { log as baseLog } from "../../../platform/lib/logger";

const log = baseLog.child({ category: "ingest" });

// Each row binds 10 parameters; postgres-js caps a statement at 65,534 bind
// parameters, so chunk large inserts to stay safely below that.
const INSERT_COLUMN_COUNT = 10;
const CHUNK_SIZE = Math.floor(60_000 / INSERT_COLUMN_COUNT);

// 2-minute TTL cache: websiteId → Set of ALL active automation IDs for that website.
// Caching all active IDs (not just the requested subset) prevents false-negative drops
// when different flush cycles trigger different automation IDs on the same website.
const activeAutomationCache = new Map<string, { ids: Set<string>; at: number }>();
const AUTOMATION_TTL_MS = 2 * 60_000;

function sweepAutomationCache(): void {
  const cutoff = Date.now() - AUTOMATION_TTL_MS;
  for (const [k, v] of activeAutomationCache) {
    if (v.at < cutoff) activeAutomationCache.delete(k);
  }
}

async function getActiveAutomationIds(websiteId: string): Promise<Set<string>> {
  const now = Date.now();
  const hit = activeAutomationCache.get(websiteId);
  if (hit && now - hit.at < AUTOMATION_TTL_MS) return hit.ids;

  const valid = await db
    .select({ id: automations.id })
    .from(automations)
    .where(and(eq(automations.websiteId, websiteId), eq(automations.isActive, true)));
  const ids = new Set(valid.map((v) => v.id));
  if (Math.random() < 0.05) sweepAutomationCache();
  activeAutomationCache.set(websiteId, { ids, at: now });
  return ids;
}

/**
 * Insert tracker-fired automation triggers. Drops unknown automation IDs and rows whose
 * automation is inactive or not on the website.
 */
export async function ingestAutomationTriggersBatch(
  /**
   * The caller's transaction, so these rows commit with the batch marker that makes them
   * replay-safe. A trigger row is what frequency caps are charged against, so a
   * double-write both over-reports and prematurely exhausts a cap.
   */
  tx: BatchTx,
  rows: AutomationTriggerQueued[],
): Promise<number> {
  if (!rows.length) return 0;

  const bySite = new Map<string, AutomationTriggerQueued[]>();
  for (const r of rows) {
    const cur = bySite.get(r.websiteId) ?? [];
    cur.push(r);
    bySite.set(r.websiteId, cur);
  }

  const written = await Promise.all(
    [...bySite].map(async ([websiteId, siteRows]) => {
      const ok = await getActiveAutomationIds(websiteId);
      const dropped = siteRows.length - siteRows.filter((r) => ok.has(r.automationId)).length;
      if (dropped > 0) {
        log.warn({ msg: "automation_triggers_dropped", website_id: websiteId, dropped, reason: "unknown_or_inactive_automation" });
      }
      const inserts = siteRows
        .filter((r) => ok.has(r.automationId))
        .map((r) => {
          const d = r.detail;
          const triggerEvent = typeof d.event === "string" ? d.event : undefined;
          const visitorId = typeof d.visitor_id === "string" ? d.visitor_id : undefined;
          const sessionId = typeof d.session_id === "string" ? d.session_id : undefined;
          const pageUrl = typeof d.url === "string" ? d.url : undefined;
          return {
            automationId: r.automationId,
            recordType: "client_trigger",
            runId: randomUUID(),
            triggerEvent,
            status: "triggered",
            visitorId,
            sessionId,
            pageUrl,
            detail: r.detail,
            createdAt: new Date(clampClientTs(r.occurredAt.getTime())),
          };
        });
      if (!inserts.length) return 0;
      // Chunked for the driver's parameter limit. No inner transaction: the caller's
      // already wraps this, so a partial failure rolls back with its marker.
      for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
        await tx.insert(automationEvents).values(inserts.slice(i, i + CHUNK_SIZE));
      }
      log.info({ msg: "automation_triggers_inserted", website_id: websiteId, n: inserts.length });
      return inserts.length;
    }),
  );

  return written.reduce((sum, n) => sum + n, 0);
}
