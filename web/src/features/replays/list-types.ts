import type { SignalCounts } from './types';

/** The flattened row the session table renders, built from a `ReplaySession`. */
export interface SessionRow {
  id: string;
  session_id: string;
  country: string;
  browser: string;
  os: string;
  device: string;
  entry_page: string;
  duration_seconds: number;
  pages_viewed: number;
  has_errors: boolean;
  has_rage_clicks: boolean;
  start_time: string;
  /** 0-100 once the session has been analysed; `null` before (or on the demo). */
  frustration_score: number | null;
  signal_counts: SignalCounts | null;
}

/** `recent`: newest first. `frustration`: worst first, unanalysed sessions last. */
export type SessionSort = 'recent' | 'frustration';

/** Device classes the server will filter on. */
export type DeviceFilter = 'all' | 'desktop' | 'mobile' | 'tablet';

/**
 * How long to wait after the last keystroke before searching.
 *
 * The search runs on the server now, so every character would otherwise be a query
 * against a table that grows without bound.
 */
export const SEARCH_DEBOUNCE_MS = 300;

export const PAGE_SIZE_OPTIONS = [25, 50, 100];
