/**
 * Tracker ingest → analytics helpers: send batches the way seentics.js does, push them
 * through the real collect buffer and durable queue, and seed raw events at known times.
 */
import { randomUUID } from "node:crypto";
import { api, application, sql, type SeededWebsite } from "../harness";
import { BatchWorker } from "../../modules/ingest/services/batch-worker.service";
import { postgresBatchQueue } from "../../modules/ingest/repositories/postgres-batch-queue";
import type { IngestFlusher } from "../../modules/ingest/interfaces";
import { log } from "../../platform/observability/logger";

/** A desktop Chrome UA — not a bot, parses to a real browser/OS/device. */
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Headers a visitor's browser sends from the site's own page, outside the consent region. */
export function siteHeaders(site: Pick<SeededWebsite, "domain">, extra: Record<string, string> = {}) {
  return { Origin: `https://${site.domain}`, "User-Agent": BROWSER_UA, "CF-IPCountry": "US", ...extra };
}

export type TrackerEventInput = {
  type?: string;
  url?: string;
  sid: string;
  vid?: string;
  ts?: number;
  data?: Record<string, unknown>;
};

export function pageview(e: TrackerEventInput) {
  return { type: e.type ?? "pageview", url: e.url ?? "/", sid: e.sid, vid: e.vid ?? `v-${e.sid}`, ts: e.ts ?? Date.now(), data: e.data ?? {} };
}

/** POST /api/v1/tracker/collect for `site` (by tracking id unless `websiteRef` given). */
export async function collect(
  site: SeededWebsite,
  body: Record<string, unknown>,
  opts: { headers?: Record<string, string>; websiteRef?: string } = {},
) {
  return api("POST", "/api/v1/tracker/collect", {
    headers: { ...siteHeaders(site), ...(opts.headers ?? {}) },
    body: { website_id: opts.websiteRef ?? site.trackingId, ...body },
  });
}

let worker: BatchWorker | null = null;

/**
 * Move everything `/collect` buffered into `analytics_events`: flush the collect buffer
 * onto the durable queue, then apply the analytics and funnel lanes — what the worker
 * process does on its timer. Waits until no batch for `websiteId` is pending, since a
 * concurrently running file's worker may have claimed it.
 */
export async function drainAnalytics(websiteId: string): Promise<void> {
  const app = application();
  await (app.modules.ingest.queue as unknown as IngestFlusher).flushNow();
  worker ??= new BatchWorker(
    postgresBatchQueue,
    { analytics: app.modules.analytics.lanes.analytics, funnels: app.modules.analytics.lanes.funnels } as never,
    log,
  );
  for (let i = 0; i < 100; i++) {
    await worker.drainOnce();
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ingest_batches
      WHERE category IN ('analytics', 'funnels') AND partition_key = ${websiteId} AND completed_at IS NULL`;
    if (!row?.n) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`analytics batches for ${websiteId} still pending`);
}

export type RawEvent = {
  type?: string;
  page?: string;
  visitor?: string;
  session: string;
  at: Date;
  referrer?: string | null;
  country?: string | null;
  device?: string | null;
  browser?: string | null;
  utm?: { source?: string; medium?: string; campaign?: string };
  properties?: Record<string, unknown>;
};

/** Insert raw events directly, at chosen times (ingest clamps client times to the last 48 h). */
export async function insertEvents(websiteId: string, events: RawEvent[]): Promise<void> {
  for (const e of events) {
    await sql`
      INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, referrer, country, device, browser,
                                    utm_source, utm_medium, utm_campaign, properties, occurred_at)
      VALUES (${websiteId}, ${e.type ?? "pageview"}, ${e.page ?? "/"}, ${e.visitor ?? `v-${e.session}`}, ${e.session},
              ${e.referrer ?? null}, ${e.country ?? null}, ${e.device ?? null}, ${e.browser ?? null},
              ${e.utm?.source ?? null}, ${e.utm?.medium ?? null}, ${e.utm?.campaign ?? null},
              ${JSON.stringify(e.properties ?? {})}::jsonb, ${e.at.toISOString()})`;
  }
}

/** Mark the UTC days of `events` stale, as ingest would have. */
export async function markStale(websiteId: string, days: string[]): Promise<void> {
  for (const day of new Set(days)) {
    await sql`INSERT INTO analytics_rollup_stale (website_id, day) VALUES (${websiteId}, ${day}::date)
              ON CONFLICT (website_id, day) DO UPDATE SET staled_at = now()`;
  }
}

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);
export const sid = () => `s-${randomUUID().slice(0, 12)}`;

/** Midnight UTC today. */
export function todayUtc(now = Date.now()): number {
  return Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00Z");
}
