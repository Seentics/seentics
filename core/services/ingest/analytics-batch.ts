import { analyticsEvents, db } from "../../db";
import type { AnalyticsIngestEvent } from "../../lib/types";
import { log as baseLog } from "../../lib/logger";
import { pickInt, pickStr, pickUtmColumns } from "./field-pickers";

const log = baseLog.child({ category: "ingest" });

const ANALYTICS_SKIP = new Set([
  "rrweb",
  "session_error",
  "console_event",
  "network_event",
  "heatmap_click",
  "heatmap_scroll",
  "heatmap_screenshot",
  "automation_trigger",
]);

/** Insert analytics rows from tracker collect (`site_id` = websites.site_id). Returns rows inserted. */
export async function ingestAnalyticsBatch(siteId: string, events: AnalyticsIngestEvent[]): Promise<number> {
  if (!events.length) return 0;
  const now = Date.now();
  const rows: (typeof analyticsEvents.$inferInsert)[] = [];
  for (const e of events) {
    const rawType = e.type || "event";
    if (ANALYTICS_SKIP.has(rawType)) continue;
    const dm = e.data ?? {};
    // seentics.track('purchase', {...}) sends type='custom', data.name='purchase'.
    // Promote the name to event_type so revenue/goals queries work without special-casing.
    const t = rawType === "custom" && typeof dm.name === "string" && dm.name.trim()
      ? dm.name.trim()
      : rawType;
    const meta = e.ingestMeta;
    const ref = pickStr(dm, ["referrer", "referer"]);
    const lang =
      pickStr(dm, ["lang", "language"]) ?? meta?.languageHint ?? null;
    const sw = pickInt(dm, ["sw", "screen_width"]);
    const sh = pickInt(dm, ["sh", "screen_height"]);
    const ts = e.ts > 0 ? new Date(e.ts) : new Date(now);
    const utm = pickUtmColumns(dm);
    rows.push({
      websiteId: siteId,
      eventType: t,
      page: e.url ?? "",
      visitorId: e.vid || e.sid || null,
      sessionId: e.sid || null,
      properties: dm,
      referrer: ref ?? null,
      country: meta?.country ?? null,
      region: meta?.region ?? null,
      city: meta?.city ?? null,
      browser: meta?.browser ?? pickStr(dm, ["browser"]) ?? null,
      device: meta?.device ?? pickStr(dm, ["device", "device_type"]) ?? null,
      os: meta?.os ?? pickStr(dm, ["os", "os_name"]) ?? null,
      language: lang ?? null,
      screenWidth: sw ?? null,
      screenHeight: sh ?? null,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      occurredAt: ts,
    });
  }
  if (!rows.length) {
    const types = [...new Set(events.map((ev) => ev.type || "(empty)"))];
    log.warn({
      msg: "analytics_ingest_all_filtered",
      site_id: siteId,
      n_in: events.length,
      event_types: types.slice(0, 25),
    });
    return 0;
  }
  const CHUNK_SIZE = 5_000;
  if (rows.length <= CHUNK_SIZE) {
    await db.insert(analyticsEvents).values(rows);
  } else {
    // Wrap multi-chunk inserts in a transaction so a partial failure doesn't
    // leave half a batch committed with the rest silently dropped.
    await db.transaction(async (tx) => {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        await tx.insert(analyticsEvents).values(rows.slice(i, i + CHUNK_SIZE));
      }
    });
  }
  log.debug({
    msg: "analytics_ingest_inserted",
    site_id: siteId,
    rows: rows.length,
    pageviews: rows.filter((r) => r.eventType === "pageview").length,
  });
  return rows.length;
}
