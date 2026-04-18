import type { ReplayChunk } from "./types";
import { compareReplayEnvelopeEvents } from "./replay-event-order";

const maxEventsPerSession = 500_000;

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
      st = {
        siteId,
        sessionId,
        events: [],
        dirty: false,
        finalizing: false,
        chunkWindowStart: null,
        nextChunkSeq: null,
      };
      this.sessions.set(k, st);
    }
    if (st.events.length + events.length > maxEventsPerSession) {
      throw new Error(`replay spool: session ${sessionId} exceeds max events`);
    }
    const wasEmpty = st.events.length === 0;
    st.events.push(...events);
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
    for (const st of this.sessions.values()) {
      if (st.finalizing || st.events.length === 0) continue;
      if (st.chunkWindowStart == null) {
        st.chunkWindowStart = now;
      }
      if (now - st.chunkWindowStart < this.chunkFlushMs) continue;
      await this.flushChunk(st);
    }
  }

  private async flushChunk(st: SessionState): Promise<void> {
    if (st.events.length === 0) return;
    st.finalizing = true;
    const batch = st.events;
    st.events = [];
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
    } finally {
      st.finalizing = false;
    }
    if (st.events.length === 0) {
      this.sessions.delete(mapKey(st.siteId, st.sessionId));
    }
  }
}
