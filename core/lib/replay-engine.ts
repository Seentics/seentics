import { env } from "../config";
import { getNextReplayChunkSequence, uploadSessionChunkGzip } from "./s3";
import { ReplaySpool } from "./spool";
import { upsertSessionMetaBatch, type SessionUpsertRow } from "./replay-db";
import { resolveWebsiteIdsLenient } from "./website-resolve";
import { compareReplayEnvelopeEvents } from "./replay-event-order";
import type { AnalyticsIngestMeta } from "./analytics-ingest-meta";
import type { TrackerEvent } from "./types";
import { log as baseLog } from "./logger";

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

/** Same span the web player uses (last rrweb timestamp − first), not envelope `ts` (e.g. `session_error` uses `Date.now()`). */
function replayTimelineMinMaxMs(batch: SessionBatch): { min: number; max: number } | null {
  let rrMin = Infinity;
  let rrMax = -Infinity;
  for (const e of batch.events) {
    if (e.type !== "rrweb") continue;
    const t = rrwebPayloadTimelineMs(e.data);
    if (t != null) {
      if (t < rrMin) rrMin = t;
      if (t > rrMax) rrMax = t;
    }
  }
  if (rrMin !== Infinity && rrMax !== -Infinity && rrMax >= rrMin) return { min: rrMin, max: rrMax };
  const env: number[] = [];
  for (const e of batch.events) {
    if (e.type !== "rrweb") continue;
    const n = typeof e.ts === "number" ? e.ts : Number(e.ts);
    if (Number.isFinite(n)) env.push(n);
  }
  if (env.length < 2) return null;
  const lo = Math.min(...env);
  const hi = Math.max(...env);
  if (hi < lo) return null;
  return { min: lo, max: hi };
}

function replayDurationSecondsFromBatch(batch: SessionBatch): number {
  const span = replayTimelineMinMaxMs(batch);
  if (!span) return 0;
  return Math.max(0, Math.floor((span.max - span.min) / 1000));
}

function replayLatestEventMsForStorage(batch: SessionBatch, fallbackEnd: number): number {
  const span = replayTimelineMinMaxMs(batch);
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
  pageIncrements: number;
  durationSeconds: number;
  tsToUse: number;
  rageClicks: boolean;
};

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

      const pageIncrements = batch.hasFullSnapshot ? 1 : 0;

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
        startedAt: new Date(batch.startTs),
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
        pageIncrements,
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
        pageIncrements: w.pageIncrements,
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
