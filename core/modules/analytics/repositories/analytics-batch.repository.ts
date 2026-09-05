import { analyticsEvents, db } from "../../../db";
import type { BatchTx } from "../../../platform/idempotency";
import type { AnalyticsIngestEvent } from "../../../platform/lib/types";
import { clampClientTs } from "../../../platform/lib/client-timestamp";
import { log as baseLog } from "../../../platform/lib/logger";
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
  "heatmap_dom_snapshot",
  "automation_trigger",
]);

// analytics_events.event_type is varchar(64); a longer client-controlled name would throw
// and take the whole INSERT (and batch) down with it.
const MAX_EVENT_TYPE_LEN = 64;
const MAX_TEXT_LEN = 2048;
const MAX_ID_LEN = 128;
const MAX_PROPERTIES_JSON_CHARS = 32 * 1024;

function capStr(v: string | null | undefined, max: number): string | null {
  if (v == null) return null;
  return v.length > max ? v.slice(0, max) : v;
}

function capProperties(dm: Record<string, unknown>): Record<string, unknown> {
  try {
    if (JSON.stringify(dm).length <= MAX_PROPERTIES_JSON_CHARS) return dm;
  } catch {
    /* unserializable — replace below */
  }
  return { _truncated: true };
}

// Each row binds 20 parameters; postgres-js caps a statement at 65,534 bind
// parameters, so keep chunks safely below that (5,000 × 20 = 100k blew up).
const INSERT_COLUMN_COUNT = 20;
const CHUNK_SIZE = Math.floor(60_000 / INSERT_COLUMN_COUNT);

/** Insert analytics rows from tracker collect (`website_id` = websites.website_id). Returns rows inserted. */
export async function ingestAnalyticsBatch(
  /**
   * The caller's transaction, so the insert commits with the batch marker that makes it
   * replay-safe. Never reach for the ambient `db` here — that would put these rows
   * outside the marker and reintroduce the double-write it prevents.
   */
  tx: BatchTx,
  websiteId: string,
  events: AnalyticsIngestEvent[],
): Promise<number> {
  if (!events.length) return 0;
  const now = Date.now();
  const rows: (typeof analyticsEvents.$inferInsert)[] = [];
  for (const e of events) {
    const rawType = e.type || "event";
    if (ANALYTICS_SKIP.has(rawType)) continue;
    const dm = e.data ?? {};
    // seentics.track('purchase', {...}) sends type='custom', data.name='purchase'.
    // Promote the name to event_type so revenue/goals queries work without special-casing.
    const trimmedName =
      rawType === "custom" && typeof dm.name === "string" ? dm.name.trim() : "";
    const t = (trimmedName || rawType).slice(0, MAX_EVENT_TYPE_LEN);
    const meta = e.ingestMeta;
    const ref = pickStr(dm, ["referrer", "referer"]);
    const lang =
      pickStr(dm, ["lang", "language"]) ?? meta?.languageHint ?? null;
    const sw = pickInt(dm, ["sw", "screen_width"]);
    const sh = pickInt(dm, ["sh", "screen_height"]);
    const ts = new Date(clampClientTs(e.ts, now));
    const utm = pickUtmColumns(dm);
    rows.push({
      websiteId: websiteId,
      eventType: t,
      page: capStr(e.url ?? "", MAX_TEXT_LEN) ?? "",
      visitorId: capStr(e.vid || e.sid || null, MAX_ID_LEN),
      sessionId: capStr(e.sid || null, MAX_ID_LEN),
      properties: capProperties(dm),
      referrer: capStr(ref, MAX_TEXT_LEN),
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
      website_id: websiteId,
      n_in: events.length,
      event_types: types.slice(0, 25),
    });
    return 0;
  }
  // Chunked because a single multi-row insert past a few thousand rows exceeds the
  // driver's parameter limit. No inner transaction: the caller's already wraps this, so a
  // partial failure rolls the whole batch back along with its marker.
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await tx.insert(analyticsEvents).values(rows.slice(i, i + CHUNK_SIZE));
  }
  log.debug({
    msg: "analytics_ingest_inserted",
    website_id: websiteId,
    rows: rows.length,
    pageviews: rows.filter((r) => r.eventType === "pageview").length,
  });
  return rows.length;
}
