import { sql } from "drizzle-orm";
import { analyticsEvents, db } from "../../../db";
import type { BatchTx } from "../../../platform/idempotency";
import type { AnalyticsIngestEvent } from "../interfaces";
import { clampClientTs } from "../../../platform/http/client-timestamp";
import { log as baseLog } from "../../../platform/observability/logger";
import { pickInt, pickStr, pickUtmColumns } from "./field-pickers";
import { classifyTrafficChannel } from "../lib/traffic-channel";

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
/**
 * Short descriptive fields: UTM tags, language, browser, device, OS. Each becomes a value
 * in the daily rollups' primary key, which Postgres caps at about 2.7 KB, so an uncapped
 * one (6 KB of random `utm_source`) failed that site-day's rollup on every rebuild.
 */
const MAX_DIM_LEN = 256;
const MAX_ID_LEN = 128;
const MAX_PROPERTIES_JSON_CHARS = 32 * 1024;

function capStr(v: string | null | undefined, max: number): string | null {
  if (v == null) return null;
  return v.length > max ? v.slice(0, max) : v;
}

const utf8 = new TextEncoder();
/**
 * Cap by UTF-8 bytes as well as characters. Page and referrer are indexed on Postgres without
 * TimescaleDB (self-hosted), and an index entry may not exceed ~2.7 KB: 2,048 characters of a
 * non-Latin path is ~6 KB and failed the insert of the whole batch it was in.
 */
function capText(v: string | null | undefined, maxChars: number, maxBytes = 2048): string | null {
  let s = capStr(v, maxChars);
  if (s == null || s.length * 3 <= maxBytes) return s;
  while (utf8.encode(s).length > maxBytes) s = s.slice(0, Math.floor(s.length * 0.9));
  return s;
}

/**
 * Contact details a site passes with an event — `track('purchase', { email })`, for its
 * server-side conversions to match the buyer by — are never stored with the analytics:
 * the conversions lane hashes its own copy, and the event log keeps everything else.
 */
const CONTACT_KEYS = ["email", "phone", "email_address", "phone_number"] as const;
export function withoutContactDetails(dm: Record<string, unknown>): Record<string, unknown> {
  if (!CONTACT_KEYS.some((k) => k in dm)) return dm;
  const out = { ...dm };
  for (const k of CONTACT_KEYS) delete out[k];
  return out;
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
    const picked = pickUtmColumns(dm);
    const utm = {
      utmSource: capStr(picked.utmSource, MAX_DIM_LEN),
      utmMedium: capStr(picked.utmMedium, MAX_DIM_LEN),
      utmCampaign: capStr(picked.utmCampaign, MAX_DIM_LEN),
    };
    const referrer = capText(ref, MAX_TEXT_LEN);
    const page = capText(e.url ?? "", MAX_TEXT_LEN) ?? "";
    rows.push({
      websiteId: websiteId,
      eventType: t,
      page,
      visitorId: capStr(e.vid || e.sid || null, MAX_ID_LEN),
      sessionId: capStr(e.sid || null, MAX_ID_LEN),
      properties: capProperties(rawType === "custom" ? withoutContactDetails(dm) : dm),
      referrer,
      country: meta?.country ?? null,
      region: meta?.region ?? null,
      city: meta?.city ?? null,
      browser: capStr(meta?.browser ?? pickStr(dm, ["browser"]) ?? null, MAX_DIM_LEN),
      device: capStr(meta?.device ?? pickStr(dm, ["device", "device_type"]) ?? null, MAX_DIM_LEN),
      os: capStr(meta?.os ?? pickStr(dm, ["os", "os_name"]) ?? null, MAX_DIM_LEN),
      language: capStr(lang ?? null, MAX_DIM_LEN),
      screenWidth: sw ?? null,
      screenHeight: sh ?? null,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      // Only pageviews are read by channel; other event types leave it NULL.
      channel: t === "pageview"
        ? classifyTrafficChannel({ referrer, page, utmSource: utm.utmSource, utmMedium: utm.utmMedium })
        : null,
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
  // Mark the website-days these rows land in as stale, so the dashboard rollups
  // (modules/analytics/rollups) rebuild them. Same transaction, so a replayed batch can
  // never add rows without also marking them — and one row per day, whatever the batch
  // size.
  const days = [...new Set(rows.map((r) => (r.occurredAt as Date).toISOString().slice(0, 10)))];
  await tx.execute(sql`
    INSERT INTO analytics_rollup_stale (website_id, day)
    SELECT ${websiteId}, d::date FROM unnest(string_to_array(${days.join(",")}, ',')) AS d
    ON CONFLICT (website_id, day) DO UPDATE SET staled_at = now()
  `);
  // And add them to the per-day counts the monthly quota is summed from (db/sql/040) —
  // same transaction, so the count and the rows cannot disagree.
  const perDay = new Map<string, number>();
  for (const r of rows) {
    const day = (r.occurredAt as Date).toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  await tx.execute(sql`
    INSERT INTO analytics_event_counts (website_id, day, events)
    SELECT ${websiteId}, d::date, n::bigint
    FROM unnest(string_to_array(${[...perDay.keys()].join(",")}, ','),
                string_to_array(${[...perDay.values()].join(",")}, ',')) AS t(d, n)
    ON CONFLICT (website_id, day) DO UPDATE SET events = analytics_event_counts.events + EXCLUDED.events
  `);
  log.debug({
    msg: "analytics_ingest_inserted",
    website_id: websiteId,
    rows: rows.length,
    pageviews: rows.filter((r) => r.eventType === "pageview").length,
  });
  return rows.length;
}
