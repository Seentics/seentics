import api from './api';

export interface ReplaySession {
  sessionId:     string;
  websiteId:     string;
  browser:       string;
  device:        string;
  os:            string;
  country:       string;
  entryPage:     string;
  startedAt:     string;
  hasRageClicks: boolean;
  /** True if a window error or unhandled rejection was reported during recording. */
  hasErrors?: boolean;
  durationSeconds: number;
  pagesViewed:     number;
}


/** A single rrweb eventWithTime object */
export interface RRWebEvent {
  type:      number;
  timestamp: number;
  data:      Record<string, unknown>;
  delay?:    number;
}

export interface SessionChunksResponse {
  session_id: string;
  meta:       ReplaySession | null;
  chunks:     Array<{ sequence: number; data: RRWebEvent[] }>;
}

export async function listSessions(websiteId: string, limit = 20, offset = 0) {
  const res = await api.get(`/replays/${websiteId}`, {
    params: { limit, offset },
  });
  return res.data as { sessions: ReplaySession[]; limit: number; offset: number };
}

export async function getSessionWithEvents(
  websiteId: string,
  sessionId: string,
): Promise<{ meta: ReplaySession | null; events: RRWebEvent[] }> {
  const res  = await api.get(`/replays/${websiteId}/${sessionId}`);
  const body = res.data as SessionChunksResponse;

  // Ordered chunk list from API; preserve chunk + row order for equal timestamps (stable replay).
  type Tagged = { ev: RRWebEvent; chunk: number; row: number };
  const tagged: Tagged[] = [];

  (body.chunks ?? []).forEach((c, chunkIdx) => {
    if (!c.data || !Array.isArray(c.data)) return;
    c.data.forEach((item: any, row: number) => {
      if (!item) return;

      let ev: RRWebEvent | null = null;

      // 1. Envelope format: { type: "rrweb", data: { type, timestamp, ... } }
      if (item.type === 'rrweb' && item.data) {
        const inner = item.data;
        const type = typeof inner.type === 'string' ? parseInt(inner.type, 10) : inner.type;
        const ts = typeof inner.timestamp === 'string' ? parseInt(inner.timestamp, 10) : inner.timestamp;
        if (typeof type === 'number' && typeof ts === 'number') {
          ev = { ...inner, type, timestamp: ts } as RRWebEvent;
        }
      }

      // 2. Raw format: { type: <number>, timestamp: <number>, ... }
      if (!ev) {
        const type = typeof item.type === 'string' ? parseInt(item.type, 10) : item.type;
        const ts = typeof item.timestamp === 'string' ? parseInt(item.timestamp, 10) : (item.timestamp || item.ts);
        if (typeof type === 'number' && typeof ts === 'number') {
          ev = { ...item, type, timestamp: ts } as RRWebEvent;
        }
      }

      if (ev) tagged.push({ ev, chunk: chunkIdx, row });
    });
  });

  tagged.sort((a, b) => {
    const dt = (a.ev.timestamp || 0) - (b.ev.timestamp || 0);
    if (dt !== 0) return dt;
    if (a.chunk !== b.chunk) return a.chunk - b.chunk;
    return a.row - b.row;
  });

  const events = tagged.map((t) => t.ev);
  return { meta: body.meta ?? null, events };
}

export async function deleteSessions(websiteId: string, sessionIds: string[]) {
  const res = await api.delete(`/replays/${websiteId}/batch`, {
    data: { sessionIds },
  });
  return res.data;
}
