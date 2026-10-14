/**
 * Session analysis: frustration signals found in a recording, and its AI summary.
 *
 * Types mirror core's `GET /replays/:site/:session/analysis`. The helpers are pure so the
 * list chips, the player panel and the timeline markers agree on labels, order and colour,
 * and can be tested without rendering either page.
 */
import api from '@/lib/api';
import type { FrustrationSignalType, SignalCounts } from './types';

export type FrustrationSignal = {
  type: FrustrationSignalType;
  /** Playback offset: ms after the recording's first event, what the player's `goto` takes. */
  atMs: number;
  page: string;
  label?: string;
  count?: number;
  detail?: string;
};

export type SessionSummary = {
  text: string;
  intent: string;
  outcome: 'succeeded' | 'struggled' | 'abandoned';
  moments: Array<{ atMs: number; label: string }>;
};

export type SummaryStatus =
  | 'ready' | 'unavailable' | 'no_data' | 'cooldown' | 'limit' | 'failed' | 'not_requested';

export interface SessionAnalysis {
  sessionId: string;
  status: 'ready' | 'pending' | 'not_found';
  score: number;
  counts: SignalCounts;
  signals: FrustrationSignal[];
  timeline: { durationMs: number; errorCount: number; pages: Array<{ path: string; atMs: number; dwellMs: number }> } | null;
  computedAt: string | null;
  summary: SessionSummary | null;
  summarySource: 'ai' | 'rules' | null;
  summaryStatus: SummaryStatus;
  retryAfterSec?: number;
}

/**
 * One session's analysis. With `summarize`, the core writes the summary if there is none
 * (once per session, rate-limited), so this can take a few seconds the first time.
 */
export async function getSessionAnalysis(
  websiteId: string,
  sessionId: string,
  summarize: boolean,
): Promise<SessionAnalysis> {
  const res = await api.get(
    `/replays/${encodeURIComponent(websiteId)}/${encodeURIComponent(sessionId.trim())}/analysis`,
    { params: { summarize: summarize ? '1' : '0' } },
  );
  return (res.data?.data ?? res.data) as SessionAnalysis;
}

/** Most severe first: the order chips, filters and lists use. */
export const SIGNAL_ORDER: FrustrationSignalType[] = [
  'rage_click', 'error_click', 'form_abandon', 'dead_click', 'u_turn', 'scroll_thrash',
];

export const SIGNAL_META: Record<FrustrationSignalType, { label: string; description: string; dot: string; chip: string }> = {
  rage_click: {
    label: 'Rage clicks',
    description: 'Three or more fast clicks in one spot',
    dot: 'bg-amber-500',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  error_click: {
    label: 'Error clicks',
    description: 'A click followed by a JavaScript error or a failed request',
    dot: 'bg-red-500',
    chip: 'bg-red-500/10 text-red-700 dark:text-red-300',
  },
  form_abandon: {
    label: 'Abandoned form',
    description: 'Form fields filled in, then left without submitting',
    dot: 'bg-fuchsia-500',
    chip: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  },
  dead_click: {
    label: 'Dead clicks',
    description: 'A link or button that did nothing',
    dot: 'bg-slate-500',
    chip: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
  u_turn: {
    label: 'U-turns',
    description: 'Left a page within seconds and went straight back',
    dot: 'bg-sky-500',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  scroll_thrash: {
    label: 'Scroll thrash',
    description: 'Scrolling back and forth, as if searching',
    dot: 'bg-violet-500',
    chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
};

/** The "Frustrated" filter: a score where something clearly went wrong (one rage cluster scores ~46). */
export const FRUSTRATED_MIN_SCORE = 30;

/** Signals present, most severe first, with their counts. */
export function signalChips(counts: SignalCounts | null | undefined): Array<{ type: FrustrationSignalType; count: number; label: string }> {
  if (!counts) return [];
  return SIGNAL_ORDER
    .filter((t) => (counts[t] ?? 0) > 0)
    .map((t) => ({ type: t, count: counts[t]!, label: SIGNAL_META[t].label }));
}

export type FrustrationTone = 'none' | 'low' | 'medium' | 'high';

export function frustrationTone(score: number | null | undefined): FrustrationTone {
  if (score == null || score <= 0) return 'none';
  if (score < FRUSTRATED_MIN_SCORE) return 'low';
  if (score < 60) return 'medium';
  return 'high';
}

export const TONE_CLASS: Record<FrustrationTone, string> = {
  none: 'bg-muted text-muted-foreground',
  low: 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-300',
  medium: 'bg-orange-500/15 text-orange-800 dark:text-orange-300',
  high: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

/** `m:ss`, or `h:mm:ss` past an hour — the player's clock. */
export function formatOffset(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Where a marker sits on a timeline `durationMs` long, as a percentage, clamped to the bar. */
export function markerPercent(atMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  return Math.min(100, Math.max(0, (atMs / durationMs) * 100));
}

export const OUTCOME_META: Record<SessionSummary['outcome'], { label: string; className: string }> = {
  succeeded: { label: 'Succeeded', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  struggled: { label: 'Struggled', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  abandoned: { label: 'Abandoned', className: 'bg-red-500/10 text-red-700 dark:text-red-300' },
};

/** What to say in place of a summary, or `null` when there is one (or none is wanted). */
export function summaryNotice(status: SummaryStatus, retryAfterSec?: number): string | null {
  switch (status) {
    case 'ready':
    case 'not_requested':
    case 'unavailable':
      return null;
    case 'no_data':
      return 'Not enough recorded activity to summarise this session.';
    case 'cooldown': {
      const minutes = Math.max(1, Math.ceil((retryAfterSec ?? 60) / 60));
      return `A summary was attempted moments ago. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    }
    case 'limit':
      return "This site has used today's session summaries. New ones will be written tomorrow.";
    case 'failed':
      return "Couldn't write a summary right now.";
  }
}

/** One line per signal for the list under the timeline: "button "Apply" ×5 · /cart". */
export function signalLine(s: FrustrationSignal): string {
  const parts: string[] = [];
  if (s.label) parts.push(s.label);
  if (s.count && s.count > 1) parts.push(`×${s.count}`);
  const head = parts.join(' ');
  const tail = [s.detail, s.page].filter(Boolean).join(' · ');
  return head && tail ? `${head} · ${tail}` : head || tail;
}
