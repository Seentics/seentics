/** Domain types for the replays feature. */



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

/** Headline figures over every session matching the filters, computed server-side. */
export interface ReplayListSummary {
  total:              number;
  withErrors:         number;
  withRageClicks:     number;
  /** Mean over sessions that have a duration at all; 0 when none do. */
  avgDurationSeconds: number;
}

export interface ReplayListPage {
  sessions: ReplaySession[];
  limit:    number;
  offset:   number;
  /** Sessions matching the filters in total, not just on this page. */
  total:    number;
  summary:  ReplayListSummary;
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
