import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { automationEvents, automations, db } from "../../db";
import type { AutomationTriggerQueued } from "../../lib/types";
import { log as baseLog } from "../../lib/logger";

const log = baseLog.child({ category: "ingest" });

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

  for (const [websiteUuid, siteRows] of bySite) {
    const idList = [...new Set(siteRows.map((r) => r.automationId))];
    const valid = await db
      .select({ id: automations.id })
      .from(automations)
      .where(
        and(
          eq(automations.websiteId, websiteUuid),
          eq(automations.isActive, true),
          inArray(automations.id, idList),
        ),
      );
    const ok = new Set(valid.map((v) => v.id));
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
          createdAt: r.occurredAt,
        };
      });
    if (!inserts.length) continue;
    await db.insert(automationEvents).values(inserts);
    log.info({ msg: "automation_triggers_inserted", website_id: websiteUuid, n: inserts.length });
  }
}
