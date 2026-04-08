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

  // Flatten all chunks and unwrap rrweb events from the TrackerEvent envelope.
  // The tracker sends either raw rrweb events or {type: "rrweb", data: <rrwebEvent>, ts, url}
  const events: RRWebEvent[] = (body.chunks ?? []).flatMap(c => {
    if (!c.data || !Array.isArray(c.data)) return [];
    return c.data.map((item: any) => {
      if (!item) return null;

      // 1. Envelope format: { type: "rrweb", data: { type, timestamp, ... } }
      if (item.type === 'rrweb' && item.data) {
        const inner = item.data;
        const type = typeof inner.type === 'string' ? parseInt(inner.type, 10) : inner.type;
        const ts = typeof inner.timestamp === 'string' ? parseInt(inner.timestamp, 10) : inner.timestamp;
        if (typeof type === 'number' && typeof ts === 'number') {
          return { ...inner, type, timestamp: ts } as RRWebEvent;
        }
      }

      // 2. Raw format: { type: <number>, timestamp: <number>, ... }
      const type = typeof item.type === 'string' ? parseInt(item.type, 10) : item.type;
      const ts = typeof item.timestamp === 'string' ? parseInt(item.timestamp, 10) : (item.timestamp || item.ts);
      if (typeof type === 'number' && typeof ts === 'number') {
        return { ...item, type, timestamp: ts } as RRWebEvent;
      }

      return null;
    }).filter((e): e is RRWebEvent => e !== null);
  });

  events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return { meta: body.meta ?? null, events };
}

export async function deleteSessions(websiteId: string, sessionIds: string[]) {
  const res = await api.delete(`/replays/${websiteId}/batch`, {
    data: { sessionIds },
  });
  return res.data;
}
