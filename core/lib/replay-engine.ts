import { env } from "../config";
import { uploadSessionBundleGzip, createBundleLocks } from "./s3";
import { ReplaySpool } from "./spool";
import { upsertSessionMetaBatch, type SessionUpsertRow } from "./replay-db";
import { resolveWebsiteIdsLenient } from "./website-resolve";
import type { TrackerEvent } from "./types";

const pgQueueCap = 16384;
const pgBatchSize = 64;
const pgBatchMs = 500;

const bundleLocks = createBundleLocks();

type RageClick = { ts: number; x: number; y: number };

type SessionBatch = {
  websiteId: string;
  events: Record<string, unknown>[];
  clicks: RageClick[];
  hasErrors: boolean;
  hasFullSnapshot: boolean;
  startTs: number;
  endTs: number;
  clientUA: string;
  clientIP: string;
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
  meta: SessionMetaLite | null;
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
      idleMs: c.spoolIdleMs,
      maxAgeMs: c.spoolMaxAgeMs,
      onFlush: async (siteId, sessionId, events) => {
        await uploadSessionBundleGzip(this.bucket, siteId, sessionId, events, bundleLocks);
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
    const batch = this.pgBuf.splice(0, pgBatchSize);
    try {
      await upsertSessionMetaBatch(batch);
    } catch (e) {
      console.error("replay pg batch failed", e);
    }
  }

  private enqueuePg(row: SessionUpsertRow): void {
    if (this.pgBuf.length >= pgQueueCap) {
      console.warn("replay: pg buffer full, dropping meta row", row.sessionId);
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
          clientUA: "",
          clientIP: "",
        };
        grouped.set(ev.sid, b);
      }
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

      let meta: SessionMetaLite | null = null;
      let pageIncrements = 0;
      if (batch.hasFullSnapshot) {
        pageIncrements = 1;
        const entryURL =
          batch.events.length > 0 && typeof batch.events[0]!.url === "string"
            ? (batch.events[0]!.url as string)
            : "";
        meta = {
          sessionId,
          websiteId: batch.websiteId,
          browser: "Unknown",
          device: "Unknown",
          os: "Unknown",
          country: "",
          entryPage: entryURL,
          startedAt: new Date(batch.startTs),
          hasRageClicks: false,
          hasErrors: batch.hasErrors,
          durationSeconds: 0,
          pagesViewed: 0,
        };
      }

      let tsToUse = batch.endTs;
      if (batch.hasFullSnapshot) tsToUse = batch.startTs;

      work.push({
        sessionId,
        batch,
        meta,
        pageIncrements,
        durationSeconds: Math.max(0, Math.floor((batch.endTs - batch.startTs) / 1000)),
        tsToUse,
        rageClicks: hasRageClickPattern(batch.clicks),
      });
    }

    const ctx = new Map<string, { siteId: string; uuidStr: string }>();
    for (const w of work) {
      const wid = w.batch.websiteId;
      if (!ctx.has(wid)) {
        ctx.set(wid, await resolveWebsiteIdsLenient(wid));
      }
      const { siteId: storageWebsiteId } = ctx.get(wid)!;

      try {
        this.spool.push(storageWebsiteId, w.sessionId, w.batch.events);
      } catch (e) {
        console.warn("replay spool push failed", e);
        continue;
      }

      const m = w.meta;
      const row: SessionUpsertRow = {
        websiteId: storageWebsiteId,
        sessionId: w.sessionId,
        tsMs: w.tsToUse,
        latestEventMs: w.batch.endTs,
        browser: m?.browser ?? "",
        device: m?.device ?? "",
        os: m?.os ?? "",
        country: m?.country ?? "",
        entryPage: m?.entryPage ?? "",
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
  events.sort((a, b) => eventTs(a) - eventTs(b));
}

function eventTs(ev: Record<string, unknown>): number {
  const t = ev.ts;
  if (typeof t === "number") return t;
  if (typeof t === "string") return Number(t) || 0;
  return 0;
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
