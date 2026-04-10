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

/** Non-rrweb custom events stored in the same chunk (e.g. session_error). */
export interface SessionCustomEvent {
  eventType: string;             // e.g. "session_error"
  timestamp: number;             // epoch ms
  url?:      string;
  data:      Record<string, unknown>;
}

/** Core GET /replays/:websiteId/:sessionId JSON (bundle-only storage; cold path uses presigned R2 URL). */
export interface SessionReplayApiResponse {
  session_id: string;
  meta:       ReplaySession | null;
  warm_chunks?: Array<{ sequence: number; data: unknown[] }>;
  replay_url?: string;
  replay_url_expires_at?: string;
}

async function fetchGzipJsonArray(url: string): Promise<unknown[]> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`Replay bundle fetch failed: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress replay bundles (no DecompressionStream).');
  }
  const ds = new DecompressionStream('gzip');
  const decompressed = await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
  const text = new TextDecoder().decode(decompressed);
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Replay bundle must be a JSON array');
  }
  return parsed;
}

function eventsFromChunkList(
  chunks: Array<{ sequence: number; data: unknown[] }>,
): { events: RRWebEvent[]; customEvents: SessionCustomEvent[] } {
  type Tagged = { ev: RRWebEvent; chunk: number; row: number };
  const tagged: Tagged[] = [];
  const customEvents: SessionCustomEvent[] = [];

  (chunks ?? []).forEach((c, chunkIdx) => {
    if (!c.data || !Array.isArray(c.data)) return;
    c.data.forEach((item: any, row: number) => {
      if (!item) return;

      let ev: RRWebEvent | null = null;

      if (item.type === 'rrweb' && item.data) {
        const inner = item.data;
        const type = typeof inner.type === 'string' ? parseInt(inner.type, 10) : inner.type;
        const ts = typeof inner.timestamp === 'string' ? parseInt(inner.timestamp, 10) : inner.timestamp;
        if (typeof type === 'number' && typeof ts === 'number') {
          ev = { ...inner, type, timestamp: ts } as RRWebEvent;
        }
      }

      if (!ev && (typeof item.type === 'number' || !Number.isNaN(parseInt(item.type, 10)))) {
        const type = typeof item.type === 'string' ? parseInt(item.type, 10) : item.type;
        const ts = typeof item.timestamp === 'string' ? parseInt(item.timestamp, 10) : (item.timestamp || item.ts);
        if (typeof type === 'number' && !Number.isNaN(type) && typeof ts === 'number') {
          ev = { ...item, type, timestamp: ts } as RRWebEvent;
        }
      }

      if (!ev && typeof item.type === 'string' && item.type !== 'rrweb') {
        const ts = typeof item.ts === 'number' ? item.ts
          : typeof item.timestamp === 'number' ? item.timestamp
          : 0;
        customEvents.push({
          eventType: item.type,
          timestamp: ts,
          url:       item.url,
          data:      item.data && typeof item.data === 'object' ? item.data : {},
        });
        return;
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
  return { events, customEvents };
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
): Promise<{ meta: ReplaySession | null; events: RRWebEvent[]; customEvents: SessionCustomEvent[] }> {
  const res = await api.get(`/replays/${websiteId}/${sessionId}`);
  const body = res.data as SessionReplayApiResponse;

  let chunks = body.warm_chunks;
  if ((!chunks || chunks.length === 0) && body.replay_url) {
    const raw = await fetchGzipJsonArray(body.replay_url);
    chunks = [{ sequence: 0, data: raw as unknown[] }];
  }

  if (!chunks?.length) {
    return { meta: body.meta ?? null, events: [], customEvents: [] };
  }

  const { events, customEvents } = eventsFromChunkList(chunks);
  return { meta: body.meta ?? null, events, customEvents };
}

export async function deleteSessions(websiteId: string, sessionIds: string[]) {
  const res = await api.delete(`/replays/${websiteId}/batch`, {
    data: { sessionIds },
  });
  return res.data;
}
