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

/** Converts warm-chunk / bundle rows into rrweb `eventWithTime` list + sidecar custom events. */
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

export async function listSessions(websiteId: string, limit = 20, offset = 0) {
  const res = await api.get(`/replays/${websiteId}`, {
    params: { limit, offset },
  });
  return res.data as { sessions: ReplaySession[]; limit: number; offset: number };
}

export async function getSessionWithEvents(
  websiteId: string,
  sessionId: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{
  meta: ReplaySession | null;
  events: RRWebEvent[];
  customEvents: SessionCustomEvent[];
  recordingPending: boolean;
}> {
  const sid = sessionId.trim();
  const res = await api.get(
    `/replays/${encodeURIComponent(websiteId)}/${encodeURIComponent(sid)}`,
  );
  const body = res.data as SessionReplayApiResponse;

  const urlRows = [...(body.replay_chunk_urls ?? [])].sort((a, b) => a.sequence - b.sequence);
  const total = urlRows.length;
  let loaded = 0;
  if (total > 0) onProgress?.(0, total);
  const chunkResults = await Promise.allSettled(
    urlRows.map((row) =>
      fetchGzipJsonArray(row.url).then((data) => {
        onProgress?.(++loaded, total);
        return { sequence: row.sequence, data: data as unknown[] };
      }),
    ),
  );
  const fromUrls: Array<{ sequence: number; data: unknown[] }> = [];
  for (const r of chunkResults) {
    if (r.status === "fulfilled") fromUrls.push(r.value);
  }
  if (urlRows.length > 0 && fromUrls.length === 0) {
    const failed = chunkResults.find((x) => x.status === "rejected") as PromiseRejectedResult | undefined;
    const msg = failed?.reason instanceof Error ? failed.reason.message : String(failed?.reason ?? "failed");
    const hint = msg.includes("404")
      ? "Got 404 — the presigned URL path is wrong. If you set S3_PUBLIC_ENDPOINT to a custom domain (e.g. Cloudflare R2 custom domain), unset it — R2's API endpoint is already public and custom domains add an extra bucket prefix that causes 404. Only set S3_PUBLIC_ENDPOINT for MinIO where the internal Docker hostname differs from the host-accessible address."
      : msg.includes("403")
      ? "Got 403 — CORS or signature mismatch. If using a custom domain for presigned URLs, R2 does not support presigned URL auth via custom domains — unset S3_PUBLIC_ENDPOINT and use the R2 API endpoint directly."
      : "Check S3_PUBLIC_ENDPOINT and CORS settings.";
    throw new Error(`Could not load replay from storage (${msg}). ${hint}`);
  }

  let chunks: Array<{ sequence: number; data: unknown[] }> = [...fromUrls];
  if (body.warm_chunks?.length) {
    chunks = [...chunks, ...body.warm_chunks];
  }

  if ((!chunks || chunks.length === 0) && body.replay_url) {
    try {
      const raw = await fetchGzipJsonArray(body.replay_url);
      chunks = [{ sequence: 0, data: raw as unknown[] }];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const hint = msg.includes("404")
        ? "Got 404 on legacy bundle URL — if S3_PUBLIC_ENDPOINT is set to a Cloudflare R2 custom domain, unset it (custom domains prepend the bucket name to the path, causing 404). Use the R2 API endpoint directly."
        : "Check S3_PUBLIC_ENDPOINT / CORS if using MinIO or R2.";
      throw new Error(`Could not load replay bundle (${msg}). ${hint}`);
    }
  }

  if (!chunks?.length) {
    return {
      meta: body.meta ?? null,
      events: [],
      customEvents: [],
      recordingPending: body.recording_pending === true,
    };
  }

  const { events, customEvents } = eventsFromChunkList(chunks);
  return { meta: body.meta ?? null, events, customEvents, recordingPending: false };
}

export async function deleteSessions(websiteId: string, sessionIds: string[]) {
  const res = await api.delete(`/replays/${websiteId}/batch`, {
    data: { sessionIds },
  });
  return res.data;
}
