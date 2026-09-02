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

/** Narrowing applied by the server, not the browser. */
export interface ReplayListParams {
  limit?:  number;
  offset?: number;
  search?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  hasErrors?:      boolean;
  hasRageClicks?:  boolean;
}

export interface ReplayListPage {
  sessions: ReplaySession[];
  limit:    number;
  offset:   number;
  /** Sessions matching the filters in total, not just on this page. */
  total:    number;
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

/** Core GET /replays/:websiteId/:sessionId JSON (chunk and/or legacy bundle storage). */
export interface SessionReplayApiResponse {
  session_id: string;
  meta:       ReplaySession | null;
  warm_chunks?: Array<{ sequence: number; data: unknown[] }>;
  /** Immutable time-based chunks (fetch in sequence and stitch). */
  replay_chunk_urls?: Array<{ sequence: number; url: string; expires_at: string }>;
  /** From core: how bytes are exposed (`chunks` = new path, `bundle` = legacy single file). */
  replay_storage?: 'chunks' | 'bundle' | 'pending' | 'legacy_inline';
  replay_chunk_count?: number;
  replay_url?: string;
  replay_url_expires_at?: string;
  /** True when metadata exists but recording bytes are not downloadable yet (retry shortly). */
  recording_pending?: boolean;
}

/** gzip magic bytes */
function isLikelyGzip(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf);
  return u.byteLength >= 2 && u[0] === 0x1f && u[1] === 0x8b;
}

/**
 * Reads replay chunk/bundle bytes from S3/MinIO (gzip JSON array, or rare plain JSON).
 * Network "empty" Preview in DevTools is normal for binary gzip — use Response size / arrayBuffer length.
 */
export async function fetchGzipJsonArray(url: string): Promise<unknown[]> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`Replay bundle fetch failed: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) {
    throw new Error(
      'Replay object is empty (0 bytes). Re-upload may be needed — check core logs around replay chunk upload.',
    );
  }

  const parseJsonArray = (label: string, text: string): unknown[] => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
      throw new Error(
        `${label}: JSON.parse failed (${e instanceof Error ? e.message : String(e)}). Starts with: ${snippet}`,
      );
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`${label}: expected JSON array, got ${typeof parsed}`);
    }
    return parsed;
  };

  const asText = new TextDecoder().decode(buf);
  const trimmed = asText.trimStart();

  if (typeof DecompressionStream === 'undefined') {
    if (trimmed.startsWith('[')) {
      return parseJsonArray('plain replay payload (no DecompressionStream)', asText);
    }
    throw new Error('This browser cannot decompress replay bundles (no DecompressionStream).');
  }

  if (isLikelyGzip(buf)) {
    try {
      const ds = new DecompressionStream('gzip');
      const decompressed = await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
      const text = new TextDecoder().decode(decompressed);
      return parseJsonArray('gzip replay payload', text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const head = Array.from(new Uint8Array(buf).slice(0, Math.min(8, buf.byteLength)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      throw new Error(
        `Replay gzip decode failed (${msg}). First bytes (hex): ${head}. Confirm the object in MinIO is gzip of a JSON array (not empty, not HTML).`,
      );
    }
  }

  return parseJsonArray('plain replay payload', asText);
}

/**
 * What to tell the operator about a chunk that would not load.
 *
 * The 404 and 403 cases are each almost always one specific misconfiguration, and saying
 * which is worth more than the status code on its own. Shared so the caller does not
 * carry three near-identical copies of this prose.
 */
export function chunkLoadHint(message: string): string {
  const lower = message.toLowerCase();
  if (message.includes('404')) {
    return 'Got 404 — the presigned URL path is wrong. If S3_PUBLIC_ENDPOINT points at a custom domain (e.g. a Cloudflare R2 custom domain), unset it: R2’s API endpoint is already public, and custom domains add a bucket prefix that causes 404. Only set S3_PUBLIC_ENDPOINT for MinIO, where the internal Docker hostname differs from the host-accessible address.';
  }
  if (message.includes('403')) {
    return 'Got 403 — CORS or signature mismatch. R2 does not support presigned-URL auth via custom domains; unset S3_PUBLIC_ENDPOINT and use the R2 API endpoint directly.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error')
  ) {
    return 'Network or CORS error — check that MinIO/S3 CORS allows browser access (see docker-compose.yml createbuckets) and that S3_PUBLIC_ENDPOINT is a hostname the browser can reach.';
  }
  return 'Check S3_PUBLIC_ENDPOINT and CORS settings.';
}

/**
 * Converts warm-chunk / bundle rows into rrweb `eventWithTime` list + sidecar custom events.
 *
 * Both halves matter to the caller. `customEvents` carries the console, network and error
 * annotations the sidebar renders; a caller that destructures only `events` silently
 * drops everything those panels show.
 */
export function eventsFromChunkList(
  chunks: Array<{ sequence: number; data: unknown[] }>,
): { events: RRWebEvent[]; customEvents: SessionCustomEvent[] } {
  type Tagged = { ev: RRWebEvent; chunk: number; row: number };
  const tagged: Tagged[] = [];
  const customEvents: SessionCustomEvent[] = [];

  const ordered = [...(chunks ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  ordered.forEach((c, chunkIdx) => {
    if (!c.data || !Array.isArray(c.data)) return;
    c.data.forEach((item: any, row: number) => {
      if (!item) return;

      let ev: RRWebEvent | null = null;

      if (item.type === 'rrweb' && item.data) {
        const inner = item.data;
        const type = typeof inner.type === 'string' ? parseInt(inner.type, 10) : inner.type;
        let ts = typeof inner.timestamp === 'string' ? parseInt(inner.timestamp, 10) : inner.timestamp;
        if (typeof ts !== 'number' || Number.isNaN(ts)) {
          const envTs = typeof item.ts === 'number' ? item.ts : Number(item.ts);
          ts = Number.isFinite(envTs) ? envTs : NaN;
        }
        if (typeof type === 'number' && !Number.isNaN(type) && typeof ts === 'number' && !Number.isNaN(ts)) {
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

/**
 * One page of recorded sessions.
 *
 * Filters go to the server. The dashboard used to request a fixed 100 rows and search
 * within them, which made "no results" mean "not in the newest 100" and made every
 * derived stat on the page a statistic about the first page rather than about the site.
 */
export async function listSessions(
  websiteId: string,
  params: ReplayListParams = {},
): Promise<ReplayListPage> {
  const query: Record<string, string | number> = {
    limit:  params.limit  ?? 20,
    offset: params.offset ?? 0,
  };
  if (params.search?.trim()) query.search = params.search.trim();
  if (params.device)         query.device = params.device;
  if (params.hasErrors)      query.has_errors = '1';
  if (params.hasRageClicks)  query.has_rage_clicks = '1';

  const res = await api.get(`/replays/${encodeURIComponent(websiteId)}`, { params: query });
  const body = res.data as Partial<ReplayListPage>;
  return {
    sessions: body.sessions ?? [],
    limit:    body.limit  ?? Number(query.limit),
    offset:   body.offset ?? Number(query.offset),
    // A core that predates the total says nothing; the page length is the honest fallback.
    total:    typeof body.total === 'number' ? body.total : (body.sessions?.length ?? 0),
  };
}

/**
 * Fetch only the session API response (metadata + signed chunk URLs) without
 * downloading any S3 bytes. Use this to start progressive chunk streaming.
 */
export async function getSessionApiResponse(
  websiteId: string,
  sessionId: string,
): Promise<SessionReplayApiResponse> {
  const sid = sessionId.trim();
  const res = await api.get(
    `/replays/${encodeURIComponent(websiteId)}/${encodeURIComponent(sid)}`,
  );
  return res.data as SessionReplayApiResponse;
}

export async function deleteSessions(websiteId: string, sessionIds: string[]) {
  const res = await api.delete(`/replays/${encodeURIComponent(websiteId)}/batch`, {
    data: { sessionIds },
  });
  return res.data;
}
