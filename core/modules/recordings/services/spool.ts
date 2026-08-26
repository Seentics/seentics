import type { ReplayChunk } from "../../../platform/lib/types";
import { compareReplayEnvelopeEvents } from "./event-order";
import { log as baseLog } from "../../../platform/lib/logger";

const log = baseLog.child({ category: "replay" });

const maxEventsPerSession = 500_000;

/**
 * Byte budget per session, tracked alongside the event count.
 *
 * The count alone is a poor proxy for memory: rrweb envelopes range from tens of
 * bytes for a mouse move to hundreds of kilobytes for a canvas or a large DOM
 * mutation, so 500k events could mean 50MB or several gigabytes. A canvas-heavy
 * single-page app was the realistic way to exhaust the process.
 */
const maxBytesPerSession = 32 * 1024 * 1024;

/** Rough retained size of an envelope. JSON length is close enough and cheap. */
function approximateBytes(ev: Record<string, unknown>): number {
  try {
    return JSON.stringify(ev).length;
  } catch {
    // Circular or otherwise unserializable: charge a nominal cost rather than
    // letting it in for free.
    return 1024;
  }
}

/** Drop idle empty sessions so the spool map cannot grow forever after visitors leave. */
const EMPTY_SESSION_IDLE_PURGE_MS = 45 * 60 * 1000;

type SessionState = {
  siteId: string;
  sessionId: string;
  events: Record<string, unknown>[];
  dirty: boolean;
  finalizing: boolean;
  /** Wall time when the current buffered window opened (first event since last flush). */
  chunkWindowStart: number | null;
  /** Next S3 chunk index; null until resolved from storage on first flush. */
  nextChunkSeq: number | null;
  /** Updated on ingest and flush; used to prune sessions with empty buffers after visitors leave. */
  lastTouchedMs: number;
  /** Serializes flushes per session — two concurrent flushes would reuse the same chunk sequence and overwrite each other in S3. */
  inflight: Promise<void> | null;
  /** Approximate retained bytes of `events`; reset whenever the tail is flushed. */
  approxBytes: number;
};

function mapKey(siteId: string, sessionId: string): string {
  return `${siteId}\0${sessionId}`;
}

function sortEvents(events: Record<string, unknown>[]): void {
  events.sort(compareReplayEnvelopeEvents);
}

/**
 * In-memory tail buffer: flush every `chunkFlushMs` into an immutable S3 chunk,
 * then clear the buffer (no read-merge bundle).
 */
export class ReplaySpool {
  private sessions = new Map<string, SessionState>();
  private chunkFlushMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onChunkFlush: (
    siteId: string,
    sessionId: string,
    sequence: number,
    events: Record<string, unknown>[],
  ) => Promise<void>;
  private getInitialSequence: (siteId: string, sessionId: string) => Promise<number>;

  constructor(opts: {
    chunkFlushMs: number;
    getInitialSequence: (siteId: string, sessionId: string) => Promise<number>;
    onChunkFlush: (
      siteId: string,
      sessionId: string,
      sequence: number,
      events: Record<string, unknown>[],
    ) => Promise<void>;
  }) {
    this.chunkFlushMs = Math.max(5_000, opts.chunkFlushMs);
    this.getInitialSequence = opts.getInitialSequence;
    this.onChunkFlush = opts.onChunkFlush;
  }

  start(): void {
    if (this.timer) return;
    const interval = Math.max(5_000, Math.min(this.chunkFlushMs / 2, 15_000));
    this.timer = setInterval(() => void this.tick(), interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async flushAll(): Promise<void> {
    const keys = [...this.sessions.keys()];
    await Promise.all(keys.map(async (k) => {
      const st = this.sessions.get(k);
      if (!st || st.events.length === 0) return;
      await this.flushChunk(st);
    }));
  }

  push(siteId: string, sessionId: string, events: Record<string, unknown>[]): void {
    if (!siteId || !sessionId || events.length === 0) return;
    const k = mapKey(siteId, sessionId);
    let st = this.sessions.get(k);
    if (!st) {
      const now = Date.now();
      st = {
        siteId,
        sessionId,
        events: [],
        dirty: false,
        finalizing: false,
        chunkWindowStart: null,
        nextChunkSeq: null,
        lastTouchedMs: now,
        inflight: null,
        approxBytes: 0,
      };
      this.sessions.set(k, st);
    }
    if (st.approxBytes >= maxBytesPerSession) {
      log.warn({
        msg: "replay_spool_byte_overflow_drop",
        session_id: sessionId,
        dropped: events.length,
        approx_bytes: st.approxBytes,
      });
      return;
    }

    const room = maxEventsPerSession - st.events.length;
    if (room <= 0) {
      log.warn({ msg: "replay_spool_overflow_drop", session_id: sessionId, dropped: events.length });
      return;
    }
    if (events.length > room) {
      log.warn({ msg: "replay_spool_overflow_truncate", session_id: sessionId, kept: room, dropped: events.length - room });
      events = events.slice(0, room);
    }
    const wasEmpty = st.events.length === 0;
    Array.prototype.push.apply(st.events, events);
    for (const ev of events) st.approxBytes += approximateBytes(ev);
    st.lastTouchedMs = Date.now();
    if (wasEmpty) {
      st.chunkWindowStart = Date.now();
    }
    st.dirty = true;
  }

  /** Unflushed tail only; detail API assigns sequence using max S3 chunk index + 1. */
  warmChunks(siteId: string, sessionId: string): ReplayChunk[] | null {
    const st = this.sessions.get(mapKey(siteId, sessionId));
    if (!st) return null;
    if (st.dirty) {
      sortEvents(st.events);
      st.dirty = false;
    }
    if (st.finalizing && st.events.length === 0) return null;
    if (st.events.length === 0) return null;
    return [{ sequence: 0, data: st.events as unknown[], timestamp: new Date() }];
  }

  remove(siteId: string, sessionId: string): void {
    this.sessions.delete(mapKey(siteId, sessionId));
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    for (const [key, st] of [...this.sessions.entries()]) {
      if (
        st.events.length === 0 &&
        !st.finalizing &&
        now - st.lastTouchedMs > EMPTY_SESSION_IDLE_PURGE_MS
      ) {
        this.sessions.delete(key);
      }
    }
    const toFlush: SessionState[] = [];
    for (const st of this.sessions.values()) {
      if (st.finalizing || st.events.length === 0) continue;
      if (st.chunkWindowStart == null) {
        st.chunkWindowStart = now;
      }
      if (now - st.chunkWindowStart < this.chunkFlushMs) continue;
      toFlush.push(st);
    }
    await Promise.all(toFlush.map((st) => this.flushChunk(st)));
  }

  /**
   * Chain flushes per session: `flushAll()` (shutdown) can race an in-flight tick
   * flush; running both concurrently would consume the same `nextChunkSeq` and the
   * second S3 put would overwrite the first chunk.
   */
  private flushChunk(st: SessionState): Promise<void> {
    const prev = st.inflight ?? Promise.resolve();
    const next = prev.catch(() => {}).then(() => this.doFlushChunk(st));
    st.inflight = next.catch(() => {});
    return next;
  }

  private async doFlushChunk(st: SessionState): Promise<void> {
    if (st.events.length === 0) return;
    st.finalizing = true;
    const batch = st.events;
    st.events = [];
    st.approxBytes = 0;
    st.dirty = false;
    st.chunkWindowStart = null;
    try {
      if (st.nextChunkSeq === null) {
        st.nextChunkSeq = await this.getInitialSequence(st.siteId, st.sessionId);
      }
      const seq = st.nextChunkSeq;
      sortEvents(batch);
      await this.onChunkFlush(st.siteId, st.sessionId, seq, batch);
      st.nextChunkSeq = seq + 1;
      st.lastTouchedMs = Date.now();
    } catch (e) {
      // Restore events so the next tick can retry rather than silently dropping them.
      st.events = [...batch, ...st.events];
      st.chunkWindowStart = Date.now();
      throw e;
    } finally {
      st.finalizing = false;
    }
    /**
     * Keep the session row even when the buffer is empty so `nextChunkSeq` survives until the next
     * ~60s window. Deleting here forced a cold `getInitialSequence()` S3 list on the next batch;
     * listing can briefly miss the chunk just written and return 0 → **overwrite chunk-0** and break
     * replays longer than one flush interval.
     */
  }
}
