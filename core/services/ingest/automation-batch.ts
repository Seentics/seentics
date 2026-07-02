import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { automationEvents, automations, db } from "../../db";
import type { AutomationTriggerQueued } from "../../lib/types";
import { clampClientTs } from "../../lib/client-timestamp";
import { log as baseLog } from "../../lib/logger";

const log = baseLog.child({ category: "ingest" });

// Each row binds 10 parameters; postgres-js caps a statement at 65,534 bind
// parameters, so chunk large inserts to stay safely below that.
const INSERT_COLUMN_COUNT = 10;
const CHUNK_SIZE = Math.floor(60_000 / INSERT_COLUMN_COUNT);

// 2-minute TTL cache: websiteUuid → Set of ALL active automation IDs for that website.
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

async function getActiveAutomationIds(websiteUuid: string): Promise<Set<string>> {
  const now = Date.now();
  const hit = activeAutomationCache.get(websiteUuid);
  if (hit && now - hit.at < AUTOMATION_TTL_MS) return hit.ids;

  const valid = await db
    .select({ id: automations.id })
    .from(automations)
    .where(and(eq(automations.websiteId, websiteUuid), eq(automations.isActive, true)));
  const ids = new Set(valid.map((v) => v.id));
  if (Math.random() < 0.05) sweepAutomationCache();
  activeAutomationCache.set(websiteUuid, { ids, at: now });
  return ids;
}

/**
 * Insert tracker-fired automation triggers. Drops unknown automation IDs and rows whose
 * automation is inactive or not on the website.
 */
export async function ingestAutomationTriggersBatch(rows: AutomationTriggerQueued[]): Promise<void> {
  if (!rows.length) return;

  const bySite = new Map<string, AutomationTriggerQueued[]>();
  for (const r of rows) {
    const cur = bySite.get(r.websiteUuid) ?? [];
    cur.push(r);
    bySite.set(r.websiteUuid, cur);
  }

  await Promise.all(
    [...bySite].map(async ([websiteUuid, siteRows]) => {
      const ok = await getActiveAutomationIds(websiteUuid);
      const dropped = siteRows.length - siteRows.filter((r) => ok.has(r.automationId)).length;
      if (dropped > 0) {
        log.warn({ msg: "automation_triggers_dropped", website_id: websiteUuid, dropped, reason: "unknown_or_inactive_automation" });
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
      if (!inserts.length) return;
      if (inserts.length <= CHUNK_SIZE) {
        await db.insert(automationEvents).values(inserts);
      } else {
        // Wrap multi-chunk inserts in a transaction so a partial failure doesn't
        // leave half a batch committed with the rest silently dropped.
        await db.transaction(async (tx) => {
          for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
            await tx.insert(automationEvents).values(inserts.slice(i, i + CHUNK_SIZE));
          }
        });
      }
      log.info({ msg: "automation_triggers_inserted", website_id: websiteUuid, n: inserts.length });
    }),
  );
}
