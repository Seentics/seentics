import { env } from "../../../config";
import { getNextReplayChunkSequence, uploadSessionChunkGzip } from "../../../platform/lib/s3";
import { ReplaySpool } from "./spool";
import { upsertSessionMetaBatch, type SessionUpsertRow } from "../repositories/recording.repository";
import { clampClientTs } from "../../../platform/lib/client-timestamp";
import { resolveWebsiteIdsLenient } from "../../../platform/lib/website-resolve";
import { compareReplayEnvelopeEvents } from "./event-order";
import type { AnalyticsIngestMeta } from "../../../platform/lib/analytics-ingest-meta";
import type { TrackerEvent } from "../../../platform/lib/types";
import { log as baseLog } from "../../../platform/lib/logger";

const log = baseLog.child({ category: "replay" });

const pgQueueCap = 16384;
const pgBatchSize = 64;
const pgBatchMs = 500;

type RageClick = { ts: number; x: number; y: number };

/** rrweb `eventWithTime.timestamp` on tracker payloads (`type: 'rrweb'`, `data` = emit object). */
function rrwebPayloadTimelineMs(data: unknown): number | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const raw = (data as Record<string, unknown>).timestamp;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Safety bound so a rogue client clock can't store an absurd duration. Real sessions
 *  are capped at 30 min by the tracker; envelope ts is clamped to [now−48h, now+5min]. */
const MAX_REPLAY_DURATION_SECONDS = 24 * 60 * 60;

/**
 * Widest activity span of the batch across ALL session events — rrweb, console,
 * network, and error — using each event's envelope `ts` (clamped upstream; for
 * rrweb events the tracker sets ts = the rrweb event timestamp, so this matches
 * the playback timeline). Basing duration on this instead of the rrweb-only span
 * means a visitor who reads a page for 30s without triggering DOM mutations still
 * reports real elapsed time, instead of collapsing to ~0.
 */
function replayActivitySpanMs(batch: SessionBatch): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const e of batch.events) {
    // Prefer the rrweb event timestamp when present; fall back to the envelope ts.
    let t = e.type === "rrweb" ? rrwebPayloadTimelineMs(e.data) : null;
    if (t == null) {
      const n = typeof e.ts === "number" ? e.ts : Number(e.ts);
      t = Number.isFinite(n) ? n : null;
    }
    if (t == null) continue;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (min === Infinity || max === -Infinity || max < min) return null;
  return { min, max };
}

function replayDurationSecondsFromBatch(batch: SessionBatch): number {
  const span = replayActivitySpanMs(batch);
  if (!span) return 0;
  const secs = Math.floor((span.max - span.min) / 1000);
  return Math.min(MAX_REPLAY_DURATION_SECONDS, Math.max(0, secs));
}

function replayLatestEventMsForStorage(batch: SessionBatch, fallbackEnd: number): number {
  const span = replayActivitySpanMs(batch);
  return span ? span.max : fallbackEnd;
}

type SessionBatch = {
  websiteId: string;
  events: Record<string, unknown>[];
  clicks: RageClick[];
  hasErrors: boolean;
  hasFullSnapshot: boolean;
  startTs: number;
  endTs: number;
  /** First event’s request-level UA/geo (same as analytics ingest). */
  ingestMeta?: AnalyticsIngestMeta;
};

type SessionMetaLite = {
  sessionId: string;
  websiteId: string;
  browser: string;
  device: string;
  os: string;
  country: string;
  entryPage: string;
  startedAt: Date;
  hasRageClicks: boolean;
  hasErrors: boolean;
  durationSeconds: number;
  pagesViewed: number;
};

type SessionWork = {
  sessionId: string;
  batch: SessionBatch;
  meta: SessionMetaLite;
  urlTransitions: number;
  firstUrl: string;
  lastUrl: string;
  durationSeconds: number;
  tsToUse: number;
  rageClicks: boolean;
};

/** Origin+path only — hash/query churn must not count as a new page. */
function normalizeReplayPageUrl(u: unknown): string {
  if (typeof u !== "string" || !u) return "";
  try {
    const p = new URL(u);
    return p.origin + p.pathname;
  } catch {
    return u;
  }
}

export class ReplayEngine {
  private spool: ReplaySpool;
  private pgBuf: SessionUpsertRow[] = [];
  private pgTimer: ReturnType<typeof setInterval>;
  private bucket: string;

  constructor() {
    const c = env();
    this.bucket = c.s3.bucket;
    this.spool = new ReplaySpool({
      chunkFlushMs: c.replayChunkFlushMs,
      getInitialSequence: async (siteId, sessionId) =>
        getNextReplayChunkSequence(this.bucket, siteId, sessionId),
      onChunkFlush: async (siteId, sessionId, sequence, events) => {
        await uploadSessionChunkGzip(this.bucket, siteId, sessionId, sequence, events);
      },
    });
    this.spool.start();
    this.pgTimer = setInterval(() => void this.flushPg(), pgBatchMs);
  }

  async shutdown(): Promise<void> {
    clearInterval(this.pgTimer);
    await this.flushPg();
    await this.spool.flushAll();
    this.spool.stop();
  }

  private async flushPg(): Promise<void> {
    if (this.pgBuf.length === 0) return;
    const all = this.pgBuf.splice(0);
    const chunks: SessionUpsertRow[][] = [];
    for (let i = 0; i < all.length; i += pgBatchSize) chunks.push(all.slice(i, i + pgBatchSize));
    await Promise.all(
      chunks.map((chunk) =>
        upsertSessionMetaBatch(chunk).catch((e: unknown) =>
          log.error({ msg: "replay_pg_batch_failed", err: String(e) }),
        ),
      ),
    );
  }

  private enqueuePg(row: SessionUpsertRow): void {
    if (this.pgBuf.length >= pgQueueCap) {
      log.warn({ msg: "replay_pg_buffer_full_drop", session_id: row.sessionId });
      return;
    }
    this.pgBuf.push(row);
    if (this.pgBuf.length >= pgBatchSize) void this.flushPg();
  }

  /** Ingest tracker-shaped events (same envelope as Go TrackerEvent). */
  async processEvents(events: TrackerEvent[]): Promise<void> {
    const grouped = new Map<string, SessionBatch>();

    for (const ev of events) {
      if (!ev.sid) continue;
      let b = grouped.get(ev.sid);
      if (!b) {
        b = {
          websiteId: ev.websiteId,
          events: [],
          clicks: [],
          hasErrors: false,
          hasFullSnapshot: false,
          startTs: ev.ts,
          endTs: ev.ts,
        };
        grouped.set(ev.sid, b);
      }
      if (ev.ingestMeta && !b.ingestMeta) b.ingestMeta = ev.ingestMeta;
      b.events.push({
        type: ev.type,
        ts: ev.ts,
        url: ev.url ?? "",
        sid: ev.sid,
        vid: ev.vid ?? "",
        data: ev.data ?? {},
      });
      if (ev.ts < b.startTs) b.startTs = ev.ts;
      if (ev.ts > b.endTs) b.endTs = ev.ts;

      if (ev.type === "session_error") b.hasErrors = true;
      if (ev.type === "rrweb" && ev.data) {
        const rrwEvType = Number(ev.data.type);
        if (rrwEvType === 2) b.hasFullSnapshot = true;
        if (rrwEvType === 3) {
          const inner = ev.data.data as Record<string, unknown> | undefined;
          if (inner) {
            const src = Number(inner.source);
            const ct = Number(inner.type);
            if (src === 2 && ct === 2) {
              const x = Number(inner.x);
              const y = Number(inner.y);
              const ts = Number(ev.data.timestamp);
              b.clicks.push({ ts: Number.isFinite(ts) ? ts : ev.ts, x, y });
            }
          }
        }
      }
    }

    const work: SessionWork[] = [];
    for (const [sessionId, batch] of grouped) {
      sortBatchEvents(batch.events);
      if (batch.clicks.length > 1) batch.clicks.sort((a, c) => a.ts - c.ts);

      /**
       * Count pages from envelope URL transitions, NOT from FullSnapshots.
       * The tracker checkpoints a FullSnapshot every 60s (`checkoutEveryNms`),
       * so snapshot counting inflated pages_viewed by roughly one per minute
       * of session time. Cross-batch boundaries are handled in the upsert via
       * first/last URL stored in the sequence-0 row's data jsonb.
       */
      let urlTransitions = 0;
      let firstUrl = "";
      let lastUrl = "";
      for (const e of batch.events) {
        const u = normalizeReplayPageUrl(e.url);
        if (!u) continue;
        if (!firstUrl) {
          firstUrl = u;
          lastUrl = u;
          continue;
        }
        if (u !== lastUrl) {
          urlTransitions++;
          lastUrl = u;
        }
      }

      // Populate metadata for every session that has any events — not just FullSnapshot ones.
      // Network/error-only sessions (no rrweb recording) still need browser/OS/country for the list view.
      const entryURL =
        batch.events.length > 0 && typeof batch.events[0]!.url === "string"
          ? (batch.events[0]!.url as string)
          : "";
      const im = batch.ingestMeta;
      const meta: SessionMetaLite = {
        sessionId,
        websiteId: batch.websiteId,
        browser: (im?.browser ?? "").trim() || "Unknown",
        device: (im?.device ?? "").trim() || "Unknown",
        os: (im?.os ?? "").trim() || "Unknown",
        country: (im?.country ?? "").trim(),
        entryPage: entryURL,
        startedAt: new Date(clampClientTs(batch.startTs)),
        hasRageClicks: false,
        hasErrors: batch.hasErrors,
        durationSeconds: 0,
        pagesViewed: 0,
      };

      let tsToUse = batch.endTs;
      if (batch.hasFullSnapshot) tsToUse = batch.startTs;

      work.push({
        sessionId,
        batch,
        meta,
        urlTransitions,
        firstUrl,
        lastUrl,
        durationSeconds: replayDurationSecondsFromBatch(batch),
        tsToUse,
        rageClicks: hasRageClickPattern(batch.clicks),
      });
    }

    // Resolve all unique website IDs in parallel rather than sequentially.
    const uniqueWids = [...new Set(work.map((w) => w.batch.websiteId))];
    const resolved = await Promise.all(uniqueWids.map((wid) => resolveWebsiteIdsLenient(wid)));
    const ctx = new Map(uniqueWids.map((wid, i) => [wid, resolved[i]!]));

    for (const w of work) {
      const wid = w.batch.websiteId;
      const { siteId: storageWebsiteId } = ctx.get(wid)!;

      try {
        this.spool.push(storageWebsiteId, w.sessionId, w.batch.events);
      } catch (e) {
        log.error({ msg: "replay_spool_push_failed", session_id: w.sessionId, err: String(e) });
        continue;
      }

      const m = w.meta;
      const row: SessionUpsertRow = {
        websiteId: storageWebsiteId,
        sessionId: w.sessionId,
        tsMs: w.tsToUse,
        latestEventMs: replayLatestEventMsForStorage(w.batch, w.batch.endTs),
        browser: m.browser,
        device: m.device,
        os: m.os,
        country: m.country,
        entryPage: m.entryPage,
        urlTransitions: w.urlTransitions,
        firstUrl: w.firstUrl,
        lastUrl: w.lastUrl,
        durationSeconds: w.durationSeconds,
        hasRageClicks: w.rageClicks,
        hasErrors: w.batch.hasErrors,
      };
      this.enqueuePg(row);
    }
  }

  warmChunks(siteId: string, sessionId: string) {
    return this.spool.warmChunks(siteId, sessionId);
  }

  removeSpool(siteId: string, sessionId: string): void {
    this.spool.remove(siteId, sessionId);
  }
}

function sortBatchEvents(events: Record<string, unknown>[]): void {
  events.sort(compareReplayEnvelopeEvents);
}

function hasRageClickPattern(clicks: RageClick[]): boolean {
  for (let i = 0; i < clicks.length; i++) {
    let count = 1;
    for (let j = i + 1; j < clicks.length; j++) {
      if (clicks[j]!.ts - clicks[i]!.ts > 1000) break;
      const dx = clicks[j]!.x - clicks[i]!.x;
      const dy = clicks[j]!.y - clicks[i]!.y;
      if (dx * dx + dy * dy <= 2500) count++;
    }
    if (count >= 3) return true;
  }
  return false;
}

let _engine: ReplayEngine | null = null;
export function getReplayEngine(): ReplayEngine {
  if (!_engine) _engine = new ReplayEngine();
  return _engine;
}
