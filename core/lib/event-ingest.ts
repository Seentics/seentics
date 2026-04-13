import { db, analyticsEvents } from "../db";
import type { AnalyticsIngestEvent } from "./types";

const SKIP = new Set([
  "rrweb",
  "session_error",
  "heatmap_click",
  "heatmap_scroll",
  "heatmap_screenshot",
  "automation_trigger",
]);

function pickStr(m: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!m) return undefined;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

function pickInt(m: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!m) return undefined;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  }
  return undefined;
}

/** Insert analytics rows from tracker collect (`site_id` = websites.site_id). */
export async function ingestAnalyticsBatch(siteId: string, events: AnalyticsIngestEvent[]): Promise<void> {
  if (!events.length) return;
  const now = Date.now();
  const rows: (typeof analyticsEvents.$inferInsert)[] = [];
  for (const e of events) {
    const t = e.type || "event";
    if (SKIP.has(t)) continue;
    const dm = e.data ?? {};
    const ref = pickStr(dm, ["referrer", "referer"]);
    const lang = pickStr(dm, ["lang", "language"]);
    const sw = pickInt(dm, ["sw", "screen_width"]);
    const sh = pickInt(dm, ["sh", "screen_height"]);
    const ts = e.ts > 0 ? new Date(e.ts) : new Date(now);
    rows.push({
      websiteSiteId: siteId,
      eventType: t,
      page: e.url ?? "",
      visitorId: e.vid || null,
      sessionId: e.sid || null,
      properties: dm,
      referrer: ref ?? null,
      country: null,
      region: null,
      city: null,
      browser: null,
      device: null,
      os: null,
      language: lang ?? null,
      screenWidth: sw ?? null,
      screenHeight: sh ?? null,
      utmSource: pickStr(dm, ["utm_source", "utmSource"]) ?? null,
      utmMedium: pickStr(dm, ["utm_medium", "utmMedium"]) ?? null,
      utmCampaign: pickStr(dm, ["utm_campaign", "utmCampaign"]) ?? null,
      occurredAt: ts,
    });
  }
  if (!rows.length) return;
  await db.insert(analyticsEvents).values(rows);
}
