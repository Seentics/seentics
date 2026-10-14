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
  /** 0-100 from the session's frustration analysis; null (or absent on an older core) until analysed. */
  frustrationScore?: number | null;
  /** Frustration signals found, by type; null until analysed. */
  signalCounts?: SignalCounts | null;
  /** One line on what happened, from the analysis; null until analysed. */
  summary?: string | null;
}

/** Frustration signals the core detects in a recording, most severe first. */
export type FrustrationSignalType =
  | 'rage_click'
  | 'error_click'
  | 'form_abandon'
  | 'dead_click'
  | 'u_turn'
  | 'scroll_thrash';

export type SignalCounts = Partial<Record<FrustrationSignalType, number>>;

/** Narrowing applied by the server, not the browser. */
export interface ReplayListParams {
  limit?:  number;
  offset?: number;
  search?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  hasErrors?:      boolean;
  hasRageClicks?:  boolean;
  /** Only sessions that started within this many days. */
  days?: number;
  /** Only analysed sessions scoring at least this (1-100). */
  minFrustration?: number;
  /** Only analysed sessions with this signal. */
  signal?: FrustrationSignalType;
  /** `recent` (default) or `frustration` (worst first). */
  sort?: 'recent' | 'frustration';
  /** One session group — see `features/replays/groups`. */
  group?: SessionGroup;
}

export type SessionGroup = 'smooth' | 'errors' | 'rage' | 'dead_clicks' | 'forms' | 'u_turns' | 'thrash' | 'gave_up';

/** Headline figures over every session matching the filters, computed server-side. */
export interface ReplayListSummary {
  total:              number;
  withErrors:         number;
  withRageClicks:     number;
  /** Mean over sessions that have a duration at all; 0 when none do. */
  avgDurationSeconds: number;
  /** Sessions in each group under the same filters; absent from an older core. */
  groups?: Partial<Record<SessionGroup, number>>;
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
  /** Reads this site's archived stylesheets (`/embed/:websiteId/stylesheet?…&st=`). */
  stylesheet_token?: string;
  stylesheet_token_expires_at?: string;
}
