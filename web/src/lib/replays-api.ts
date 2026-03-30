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
  const res = await api.get(`/api/v1/replays/${websiteId}`, {
    params: { limit, offset },
  });
  return res.data as { sessions: ReplaySession[]; limit: number; offset: number };
}

export async function getSessionWithEvents(
  websiteId: string,
  sessionId: string,
): Promise<{ meta: ReplaySession | null; events: RRWebEvent[] }> {
  const res  = await api.get(`/api/v1/replays/${websiteId}/${sessionId}`);
  const body = res.data as SessionChunksResponse;

  // Flatten all chunks and unwrap rrweb events from the TrackerEvent envelope.
  // The tracker sends: {type: "rrweb", data: <rrwebEventWithTime>, ts, url, sid, vid}
  // We extract the inner `data` object which is the real rrweb event.
  const events: RRWebEvent[] = (body.chunks ?? []).flatMap(c =>
    (c.data ?? []).map((item: any) => {
      if (item.type === 'rrweb' && item.data && typeof item.data.type === 'number') {
        return item.data as RRWebEvent;   // unwrap TrackerEvent envelope
      }
      if (typeof item.type === 'number') {
        return item as RRWebEvent;        // already a raw rrweb event (legacy)
      }
      return null;
    }).filter((e): e is RRWebEvent => e !== null),
  );

  events.sort((a, b) => a.timestamp - b.timestamp);
  return { meta: body.meta ?? null, events };
}
