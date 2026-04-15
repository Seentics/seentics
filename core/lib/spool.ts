import type { ReplayChunk } from "./types";
import { compareReplayEnvelopeEvents } from "./replay-event-order";

const maxEventsPerSession = 500_000;

type SessionState = {
  siteId: string;
  sessionId: string;
  events: Record<string, unknown>[];
  dirty: boolean;
  finalizing: boolean;
  created: number;
  lastActivity: number;
};

function mapKey(siteId: string, sessionId: string): string {
  return `${siteId}\0${sessionId}`;
}

function sortEvents(events: Record<string, unknown>[]): void {
  events.sort(compareReplayEnvelopeEvents);
}

/** In-memory buffer: idle / max-age flush callbacks supplied by engine. */
export class ReplaySpool {
  private sessions = new Map<string, SessionState>();
  private idleMs: number;
  private maxAgeMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onFlush: (siteId: string, sessionId: string, events: Record<string, unknown>[]) => Promise<void>;

  constructor(opts: {
    idleMs: number;
    maxAgeMs: number;
    onFlush: (siteId: string, sessionId: string, events: Record<string, unknown>[]) => Promise<void>;
  }) {
    this.idleMs = opts.idleMs;
    this.maxAgeMs = opts.maxAgeMs;
    this.onFlush = opts.onFlush;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), Math.max(5_000, this.idleMs / 2));
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async flushAll(): Promise<void> {
    const keys = [...this.sessions.keys()];
    await Promise.all(
      keys.map(async (k) => {
        const st = this.sessions.get(k);
        if (!st || st.events.length === 0) return;
        await this.finalize(st);
      }),
    );
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
        created: now,
        lastActivity: now,
      };
      this.sessions.set(k, st);
    }
    if (st.events.length + events.length > maxEventsPerSession) {
      throw new Error(`replay spool: session ${sessionId} exceeds max events`);
    }
    st.events.push(...events);
    st.dirty = true;
    st.lastActivity = Date.now();
  }

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
      const idle = now - st.lastActivity;
      const age = now - st.created;
      if (idle >= this.idleMs || age >= this.maxAgeMs) {
        await this.finalize(st);
      }
    }
  }

  private async finalize(st: SessionState): Promise<void> {
    if (st.events.length === 0) return;
    st.finalizing = true;
    const batch = st.events;
    st.events = [];
    st.dirty = false;
    try {
      await this.onFlush(st.siteId, st.sessionId, batch);
    } finally {
      st.finalizing = false;
      st.lastActivity = Date.now();
    }
    if (st.events.length === 0) {
      this.sessions.delete(mapKey(st.siteId, st.sessionId));
    }
  }
}
