'use client';

import 'rrweb/dist/style.css';
import 'rrweb-player/dist/style.css';

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
// rrweb-player bundles its own rrweb; avoid importing Replayer from top-level 'rrweb'
// or TypeScript merges two incompatible Timer/PlayerContext definitions.
import type PlayerCtor from 'rrweb-player';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { displayRealtimePath, pathFromRaw, shortenSessionSlugInPath, stripWebsiteDashboardPrefix } from '@/lib/realtime-path';
import {
  AlertTriangle,
  CircleDot,
  FastForward,
  FileText,
  Gauge,
  Maximize2,
  MousePointerClick,
  Pause,
  Play,
  Rewind,
  SkipForward,
} from 'lucide-react';
import type { RRWebEvent, SessionCustomEvent } from '@/lib/replays-api';

type PlayerInstance = InstanceType<typeof PlayerCtor>;

export type SessionReplaySurfaceAPI = {
  goto: (offsetMs: number, shouldPlay?: boolean) => void;
  toggle: () => void;
  toggleFullscreen: () => void;
  /** Append rrweb events to the running player without re-mounting it. */
  addEvents: (events: RRWebEvent[]) => void;
};

function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) {
    return `${h}:${(m % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

const SPEED_OPTIONS = [0.5, 1, 1.25, 1.5, 2, 4, 8] as const;

const SEEK_STEP_MS = 10_000;

/** rrweb EventType.Meta */
const RRWEB_META = 4;
/** rrweb EventType.FullSnapshot — new DOM state (often a navigation or major paint). */
const RRWEB_FULL = 2;
/** rrweb EventType.IncrementalSnapshot */
const RRWEB_INC = 3;

export type ReplayTimelineMarker = {
  /** Offset from first event timestamp (ms), matches rrweb-player `goto`. */
  offsetMs: number;
  kind: 'page' | 'rage';
};

type RageClickPt = { ts: number; x: number; y: number };

function extractRageClickPoints(events: RRWebEvent[], t0: number): RageClickPt[] {
  const out: RageClickPt[] = [];
  for (const ev of events) {
    if (ev.type !== RRWEB_INC) continue;
    // Flattened rrweb eventWithTime: { type: 3, timestamp, data: { source, type, x, y } }
    let inner = ev.data as Record<string, unknown> | undefined;
    if (!inner) continue;
    if (inner.source === undefined && inner.data && typeof inner.data === 'object') {
      inner = inner.data as Record<string, unknown>;
    }
    if (Number(inner.source) !== 2 || Number(inner.type) !== 2) continue; // MouseInteraction / Click
    const x = Number(inner.x);
    const y = Number(inner.y);
    const ts = Number(ev.timestamp) - t0;
    if (!Number.isFinite(ts) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ ts, x, y });
  }
  return out;
}

/** Same idea as backend rage detection: 3+ clicks within 1s inside ~50px. */
function rageClusterStarts(clicks: RageClickPt[]): number[] {
  const markers: number[] = [];
  const consumed = new Set<number>();
  for (let i = 0; i < clicks.length; i++) {
    if (consumed.has(i)) continue;
    let count = 1;
    for (let j = i + 1; j < clicks.length; j++) {
      if (clicks[j].ts - clicks[i].ts > 1000) break;
      const dx = clicks[j].x - clicks[i].x;
      const dy = clicks[j].y - clicks[i].y;
      if (dx * dx + dy * dy <= 2500) count++;
    }
    if (count >= 3) {
      markers.push(clicks[i].ts);
      for (let k = i; k < clicks.length; k++) {
        if (clicks[k].ts - clicks[i].ts > 1000) break;
        const dx = clicks[k].x - clicks[i].x;
        const dy = clicks[k].y - clicks[i].y;
        if (dx * dx + dy * dy <= 2500) consumed.add(k);
      }
    }
  }
  return markers;
}

/** Derives click/scroll/input counts and exit page from the rrweb event stream. */
export function buildSessionActivityStats(events: RRWebEvent[]): SessionActivityStats {
  let totalClicks = 0;
  let inputInteractions = 0;
  let maxScrollPx = 0;
  let exitPage: string | null = null;

  for (const ev of events) {
    if (ev.type === RRWEB_META) {
      const d = ev.data as { href?: unknown };
      if (typeof d.href === 'string' && d.href.trim()) exitPage = d.href.trim();
      continue;
    }
    if (ev.type !== RRWEB_INC) continue;
    let inner = ev.data as Record<string, unknown>;
    // Handle both flat { source, type, x, y } and nested { data: { source, type, x, y } }
    if (inner.source === undefined && inner.data && typeof inner.data === 'object') {
      inner = inner.data as Record<string, unknown>;
    }
    const source = Number(inner.source);
    if (source === 2 && Number(inner.type) === 2) totalClicks++;         // MouseInteraction Click
    if (source === 3) {                                                   // Scroll
      const y = Number(inner.y);
      if (Number.isFinite(y) && y > maxScrollPx) maxScrollPx = y;
    }
    if (source === 5) inputInteractions++;                                // Input
  }

  return { totalClicks, inputInteractions, maxScrollPx, exitPage };
}

/** Extracts JS error detail rows from custom (non-rrweb) events stored in the same chunks. */
export function buildSessionErrorDetails(
  customEvents: SessionCustomEvent[],
  t0: number,
): SessionErrorDetail[] {
  return customEvents
    .filter(e => e.eventType === 'session_error')
    .map((e, i) => {
      const d = e.data as Record<string, unknown>;
      const message  = String(d.message || d.error || 'Unknown error');
      const stack    = typeof d.stack === 'string' ? d.stack : undefined;
      const filename = typeof d.filename === 'string' ? d.filename : undefined;
      const lineno   = typeof d.lineno === 'number'   ? d.lineno   : undefined;
      const colno    = typeof d.colno === 'number'    ? d.colno    : undefined;
      const url      = e.url || (typeof d.url === 'string' ? d.url : undefined);
      const ts       = e.timestamp;
      const offsetMs = t0 > 0 && ts > 0 ? Math.max(0, ts - t0) : null;
      return { message, stack, filename, lineno, colno, url, timestamp: ts, offsetMs, _i: i } as SessionErrorDetail & { _i: number };
    });
}

/** Extracts console log entries from console_event custom events. */
export function buildConsoleDetails(
  customEvents: SessionCustomEvent[],
  t0: number,
): SessionConsoleDetail[] {
  return customEvents
    .filter(e => e.eventType === 'console_event')
    .map(e => {
      const d = e.data as Record<string, unknown>;
      const level = (['log', 'info', 'warn', 'error', 'debug'].includes(d.level as string)
        ? d.level
        : 'log') as SessionConsoleDetail['level'];
      const args: string[] = Array.isArray(d.args)
        ? d.args.map(a => (typeof a === 'string' ? a : String(a)))
        : [];
      const ts = e.timestamp;
      const offsetMs = t0 > 0 && ts > 0 ? Math.max(0, ts - t0) : null;
      return { level, args, timestamp: ts, offsetMs };
    });
}

/** Extracts network request entries from network_event custom events. */
export function buildNetworkDetails(
  customEvents: SessionCustomEvent[],
  t0: number,
): SessionNetworkDetail[] {
  return customEvents
    .filter(e => e.eventType === 'network_event')
    .map(e => {
      const d = e.data as Record<string, unknown>;
      const method   = typeof d.method === 'string' ? d.method : 'GET';
      const url      = typeof d.url === 'string' ? d.url : '';
      const status   = typeof d.status === 'number' ? d.status : 0;
      const duration = typeof d.duration === 'number' ? d.duration : 0;
      const error    = typeof d.error === 'string' ? d.error : undefined;
      const ts = e.timestamp;
      const offsetMs = t0 > 0 && ts > 0 ? Math.max(0, ts - t0) : null;
      return { method, url, status, duration, error, timestamp: ts, offsetMs };
    });
}

/** Page boundaries + approximate rage moments derived from the recording (not server flags). */
export function buildReplayTimelineMarkers(events: RRWebEvent[]): ReplayTimelineMarker[] {
  if (events.length < 2) return [];
  const t0 = events[0].timestamp;
  const list: ReplayTimelineMarker[] = [];
  for (const ev of events) {
    if (ev.type !== RRWEB_FULL) continue;
    const off = ev.timestamp - t0;
    if (off <= 0) continue;
    list.push({ offsetMs: off, kind: 'page' });
  }
  for (const ts of rageClusterStarts(extractRageClickPoints(events, t0))) {
    if (ts >= 0) list.push({ offsetMs: ts, kind: 'rage' });
  }
  list.sort((a, b) => a.offsetMs - b.offsetMs);
  return list;
}

export type ReplayLogEntryKind = 'start' | 'page' | 'rage' | 'error';

export type ReplayLogEntry = {
  id: string;
  kind: ReplayLogEntryKind;
  title: string;
  detail?: string;
  /** Playback offset in ms; null when we can't seek (e.g. error without timestamp). */
  offsetMs: number | null;
};

/** Aggregate activity counts derived from the rrweb event stream. */
export type SessionActivityStats = {
  totalClicks:       number;
  inputInteractions: number;
  maxScrollPx:       number;
  exitPage:          string | null;
};

/** One JS error extracted from a session_error custom event. */
export type SessionErrorDetail = {
  message:   string;
  stack?:    string;
  filename?: string;
  lineno?:   number;
  colno?:    number;
  url?:      string;
  /** Epoch ms from the stored event (0 when missing). */
  timestamp: number;
  /** Playback seek offset (ms from recording start); null when timestamp is unavailable. */
  offsetMs:  number | null;
};

/** One console log entry extracted from a console_event custom event. */
export type SessionConsoleDetail = {
  level:     'log' | 'info' | 'warn' | 'error' | 'debug';
  args:      string[];
  timestamp: number;
  offsetMs:  number | null;
};

/** One network request extracted from a network_event custom event. */
export type SessionNetworkDetail = {
  method:    string;
  url:       string;
  status:    number;
  duration:  number;
  error?:    string;
  timestamp: number;
  offsetMs:  number | null;
};

const LOG_KIND_ORDER: Record<ReplayLogEntryKind, number> = {
  start: 0,
  page: 1,
  rage: 2,
  error: 3,
};

function replayPathKey(href: string, websiteId?: string): string {
  let path = pathFromRaw(href.trim());
  if (!path.startsWith('/')) path = `/${path}`;
  if (websiteId) path = stripWebsiteDashboardPrefix(path, websiteId);
  return shortenSessionSlugInPath(path);
}

function formatReplayLogPathDetail(raw: string, websiteId?: string): string {
  return displayRealtimePath(raw, websiteId ?? '', 72);
}

function hrefAfterFullSnapshot(events: RRWebEvent[], snapIdx: number): string | undefined {
  for (let j = snapIdx + 1; j < events.length; j++) {
    if (events[j].type === RRWEB_FULL) return undefined;
    if (events[j].type === RRWEB_META) {
      const d = events[j].data as { href?: unknown };
      if (typeof d.href === 'string' && d.href.trim()) return d.href.trim();
    }
  }
  return undefined;
}

/**
 * Notable moments for the sidebar: recording start, one row per **distinct URL** (skips repeated
 * rrweb full snapshots on the same path — the scrubber still has every snapshot).
 */
export function buildReplayLogEntries(
  events: RRWebEvent[],
  opts?: {
    entryPage?: string;
    hasErrors?: boolean;
    hasRageClicks?: boolean;
    websiteId?: string;
    errorDetails?: SessionErrorDetail[];
  },
): ReplayLogEntry[] {
  if (events.length < 2) return [];
  const t0 = events[0].timestamp;
  const websiteId = opts?.websiteId;
  const out: ReplayLogEntry[] = [];

  out.push({
    id: 'start',
    kind: 'start',
    title: 'Recording start',
    detail: opts?.entryPage?.trim() ? formatReplayLogPathDetail(opts.entryPage.trim(), websiteId) : undefined,
    offsetMs: 0,
  });

  let lastPathKey: string | null = opts?.entryPage?.trim()
    ? replayPathKey(opts.entryPage.trim(), websiteId)
    : null;

  let pageSeq = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type !== RRWEB_FULL) continue;
    const off = events[i].timestamp - t0;
    const href = hrefAfterFullSnapshot(events, i);
    if (off <= 0) {
      if (href?.trim()) {
        const h = href.trim();
        out[0] = {
          ...out[0],
          detail: formatReplayLogPathDetail(h, websiteId),
        };
        lastPathKey = replayPathKey(h, websiteId);
      }
      continue;
    }
    const htrim = href?.trim();
    if (!htrim) continue;
    const pathKey = replayPathKey(htrim, websiteId);
    if (pathKey === lastPathKey) continue;
    lastPathKey = pathKey;
    pageSeq += 1;
    out.push({
      id: `page-${pageSeq}-${off}`,
      kind: 'page',
      title: 'Page',
      detail: formatReplayLogPathDetail(htrim, websiteId),
      offsetMs: off,
    });
  }

  const rageOffsets = rageClusterStarts(extractRageClickPoints(events, t0));
  rageOffsets.forEach((ts, ri) => {
    out.push({
      id: `rage-${ri}-${ts}`,
      kind: 'rage',
      title: 'Rage click pattern',
      detail: '3+ fast clicks within ~1s in ~50px',
      offsetMs: ts,
    });
  });

  if (opts?.hasRageClicks && rageOffsets.length === 0) {
    out.push({
      id: 'rage-session-flag',
      kind: 'rage',
      title: 'Rage clicks (session)',
      detail: 'Flagged when saved; no matching click cluster in this event stream',
      offsetMs: null,
    });
  }

  const errs = opts?.errorDetails ?? [];
  if (errs.length > 0) {
    errs.forEach((err, i) => {
      const base = err.filename?.split('/').pop() ?? '';
      const fileRef = base
        ? `${base}${err.lineno != null ? `:${err.lineno}` : ''}`
        : undefined;
      const msg = err.message.length > 72 ? `${err.message.slice(0, 72)}…` : err.message;
      out.push({
        id: `error-${i}`,
        kind: 'error',
        title: msg,
        detail: fileRef,
        offsetMs: err.offsetMs,
      });
    });
  } else if (opts?.hasErrors) {
    out.push({
      id: 'client-error',
      kind: 'error',
      title: 'Client error',
      detail: 'JavaScript error or unhandled rejection (time not pinned in recording)',
      offsetMs: null,
    });
  }

  out.sort((a, b) => {
    const ao = a.offsetMs ?? Number.POSITIVE_INFINITY;
    const bo = b.offsetMs ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return LOG_KIND_ORDER[a.kind] - LOG_KIND_ORDER[b.kind];
  });

  return out;
}

function LogKindIcon({ kind }: { kind: ReplayLogEntryKind }) {
  switch (kind) {
    case 'start':
      return <CircleDot className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
    case 'page':
      return <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400" />;
    case 'rage':
      return <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
    case 'error':
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
    default:
      return null;
  }
}

export const ReplaySessionTimelineLog = memo(function ReplaySessionTimelineLog({
  entries,
  currentMs,
  durationMs,
  playing,
  player,
  embedded = false,
}: {
  entries: ReplayLogEntry[];
  currentMs: number;
  durationMs: number;
  playing: boolean;
  player: PlayerInstance;
  /** Sit inside a parent Card — lighter frame, no second heavy shadow. */
  embedded?: boolean;
}) {
  const { syncNow } = useReplayPlayback();
  if (entries.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center border border-dashed border-border bg-muted/15 px-4 py-10 text-center',
          embedded ? 'rounded-lg' : 'rounded-lg',
        )}
      >
        <p className="text-xs text-muted-foreground">No key moments indexed for this recording.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'text-left',
        embedded
          ? 'rounded-lg border border-border bg-muted/20'
          : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card',
      )}
    >
      <ul
        className={cn(
          !embedded &&
            'min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]',
        )}
      >
        {entries.map((e, idx) => {
          const canSeek = e.offsetMs !== null && durationMs > 0;
          const active =
            canSeek &&
            e.offsetMs !== null &&
            Math.abs(currentMs - e.offsetMs) < 2800;
          const timeLabel =
            e.offsetMs === null ? '—' : fmtClock(Math.min(durationMs, Math.max(0, e.offsetMs)));

          // Per-page duration: diff to the next page/start entry (skip rage/error markers).
          let pageDuration: string | null = null;
          if ((e.kind === 'start' || e.kind === 'page') && e.offsetMs !== null) {
            const nextPageEntry = entries.slice(idx + 1).find(
              n => (n.kind === 'start' || n.kind === 'page') && n.offsetMs !== null,
            );
            const endMs = nextPageEntry?.offsetMs ?? durationMs;
            const spanMs = endMs - e.offsetMs;
            if (spanMs > 0) {
              const spanS = Math.floor(spanMs / 1000);
              const spanM = Math.floor(spanS / 60);
              pageDuration = spanM > 0
                ? `${spanM}m ${(spanS % 60).toString().padStart(2, '0')}s`
                : `${spanS}s`;
            }
          }

          const detail = e.detail?.trim();
          const primaryLine = detail || e.title;
          const kindLine = detail && detail !== e.title ? e.title : null;

          return (
            <li key={e.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                disabled={!canSeek}
                title={canSeek ? 'Jump to this moment' : undefined}
                className={cn(
                  'flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors',
                  'text-[11px] leading-snug',
                  canSeek && 'cursor-pointer hover:bg-muted/70 dark:hover:bg-muted/40',
                  !canSeek && 'cursor-default opacity-95',
                  active && 'bg-primary/10',
                )}
                onClick={() => {
                  if (e.offsetMs === null) return;
                  try {
                    player.goto(Math.min(durationMs, Math.max(0, e.offsetMs)), playing);
                  } catch {
                    /* ignore */
                  }
                  requestAnimationFrame(() => syncNow());
                }}
              >
                <span className="mt-0.5">
                  <LogKindIcon kind={e.kind} />
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'min-w-0 font-mono text-xs font-medium text-foreground',
                        !detail && 'font-sans',
                      )}
                    >
                      {primaryLine}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground">
                      {pageDuration && (
                        <span className="text-[10px] text-muted-foreground/70">{pageDuration}</span>
                      )}
                      {timeLabel}
                    </span>
                  </span>
                  {kindLine ? (
                    <span className="block text-[10px] font-medium tracking-wide text-muted-foreground">
                      {kindLine}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/**
 * Re-apply wrapper transform after resize. Use contain (Math.min scale) so the full recording
 * width is always visible without side-clipping. Anchor at the top center so any extra vertical
 * space is letterboxed at the bottom rather than cropping the top of the page.
 */
const PLAYER_MAX_SCALE = 100;

function readReplayerLogicalSize(
  replayer: { wrapper: HTMLElement; iframe: HTMLIFrameElement },
  resizePayload?: { width?: number; height?: number },
): { w: number; h: number } {
  const pw = Number(resizePayload?.width);
  const ph = Number(resizePayload?.height);
  if (pw > 1 && ph > 1) return { w: pw, h: ph };

  // Prefer iframe layout box (recorded viewport). Full scrollWidth/scrollHeight skews scale
  // on long pages and can make the mirrored DOM spill outside the shell.
  const ow = replayer.iframe.offsetWidth;
  const oh = replayer.iframe.offsetHeight;
  if (ow > 1 && oh > 1) return { w: ow, h: oh };

  try {
    const doc = replayer.iframe.contentDocument?.documentElement;
    if (doc) {
      const w = doc.clientWidth;
      const h = doc.clientHeight;
      if (w > 1 && h > 1) return { w, h };
    }
  } catch {
    /* cross-origin or not ready */
  }

  return { w: Math.max(ow, 1), h: Math.max(oh, 1) };
}

function applyReplayCoverScale(
  replayer: { wrapper: HTMLElement; iframe: HTMLIFrameElement },
  containerW: number,
  containerH: number,
  maxScale: number,
  resizePayload?: { width?: number; height?: number },
): void {
  const { w: fw, h: fh } = readReplayerLogicalSize(replayer, resizePayload);
  if (fw < 2 || fh < 2 || containerW < 2 || containerH < 2) return;
  const widthScale = containerW / fw;
  const heightScale = containerH / fh;
  const scale = Math.min(maxScale, Math.min(widthScale, heightScale));
  replayer.wrapper.style.transformOrigin = '50% 0';
  replayer.wrapper.style.transform = `translate(-50%, 0) scale(${scale})`;
}

/** Minimal surface of rrweb Replayer for our chrome (avoids duplicate rrweb type graphs). */
export type SessionReplayerCore = {
  getCurrentTime: () => number;
  on: (ev: string, fn: (payload: unknown) => void) => void;
  off: (ev: string, fn: (payload: unknown) => void) => void;
};

/** Passed to the sidebar for the timeline + key moments panel. */
export type SessionReplayBridge = {
  player: PlayerInstance;
  replayer: SessionReplayerCore;
  durationMs: number;
  markers: ReplayTimelineMarker[];
  logEntries: ReplayLogEntry[];
  activityStats: SessionActivityStats;
  errorDetails: SessionErrorDetail[];
  consoleDetails: SessionConsoleDetail[];
  networkDetails: SessionNetworkDetail[];
};

/** Throttle UI updates while playing — avoids 60 React commits/sec from duplicate RAF loops. */
const PLAYBACK_UI_MS = 100;

export type ReplayPlaybackValue = {
  currentMs: number;
  playing: boolean;
  /** Call after a seek while paused so the scrubber and clock match `getCurrentTime()`. */
  syncNow: () => void;
};

const ReplayPlaybackContext = createContext<ReplayPlaybackValue | null>(null);

/** Session replay timeline + transport read a single shared clock (see `ReplayPlaybackProvider`). */
export function useReplayPlayback(): ReplayPlaybackValue {
  return (
    useContext(ReplayPlaybackContext) ?? {
      currentMs: 0,
      playing: false,
      syncNow: () => {},
    }
  );
}

/** Wrap the replay main column + sidebar so timeline and transport share one playback clock. */
export function ReplayPlaybackProvider({
  bridge,
  onPlaybackMs,
  children,
}: {
  bridge: SessionReplayBridge | null;
  onPlaybackMs?: (ms: number) => void;
  children: ReactNode;
}) {
  const replayer = bridge?.replayer ?? null;
  const durationMs = bridge?.durationMs ?? 0;
  const enabled = Boolean(bridge && replayer && durationMs > 0);

  const value = useReplayPlaybackClock(replayer, durationMs, enabled, onPlaybackMs);

  return <ReplayPlaybackContext.Provider value={value}>{children}</ReplayPlaybackContext.Provider>;
}

function useReplayPlaybackClock(
  replayer: SessionReplayerCore | null,
  durationMs: number,
  enabled: boolean,
  onPlaybackMs?: (ms: number) => void,
): ReplayPlaybackValue {
  const onPlaybackMsRef = useRef(onPlaybackMs);
  onPlaybackMsRef.current = onPlaybackMs;

  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  const readTime = useCallback(() => {
    if (!replayer || durationMs <= 0) return 0;
    try {
      let t = replayer.getCurrentTime();
      if (typeof t !== 'number' || Number.isNaN(t)) return 0;
      return Math.min(durationMs, Math.max(0, t));
    } catch {
      return 0;
    }
  }, [replayer, durationMs]);

  const syncNow = useCallback(() => {
    setCurrentMs(readTime());
  }, [readTime]);

  useEffect(() => {
    if (!enabled || !replayer) {
      setPlaying(false);
      setCurrentMs(0);
      return;
    }
    const handler = (payload: unknown) => {
      const p = payload as { player?: { value: string } };
      const v = p.player?.value;
      if (v === 'playing') setPlaying(true);
      if (v === 'paused') {
        setPlaying(false);
        setCurrentMs(readTime());
      }
    };
    replayer.on('state-change', handler);
    try {
      const v = (replayer as { service?: { state?: { value: string } } }).service?.state?.value;
      setPlaying(v === 'playing');
    } catch {
      /* ignore */
    }
    setCurrentMs(readTime());
    return () => {
      try {
        replayer.off('state-change', handler);
      } catch {
        /* ignore */
      }
    };
  }, [enabled, replayer, readTime]);

  useEffect(() => {
    if (!enabled || !replayer || durationMs <= 0) return;

    let raf = 0;
    let lastUi = 0;

    const tick = () => {
      const t = readTime();
      onPlaybackMsRef.current?.(t);
      const now = performance.now();
      if (now - lastUi >= PLAYBACK_UI_MS) {
        lastUi = now;
        setCurrentMs(t);
      }
      raf = requestAnimationFrame(tick);
    };

    if (playing) {
      raf = requestAnimationFrame(tick);
    } else {
      const t = readTime();
      setCurrentMs(t);
      onPlaybackMsRef.current?.(t);
    }

    return () => cancelAnimationFrame(raf);
  }, [enabled, replayer, durationMs, readTime, playing]);

  return useMemo(
    () => ({ currentMs, playing, syncNow }),
    [currentMs, playing, syncNow],
  );
}

/** Progress bar only under the video — markers live in the sidebar list, not on the rail. */
function ReplayScrubberTrack({
  player,
  durationMs,
}: {
  player: PlayerInstance;
  durationMs: number;
}) {
  const { currentMs, playing, syncNow } = useReplayPlayback();
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const scrubMovedRef = useRef(false);

  const pct = durationMs > 0 ? Math.min(100, (currentMs / durationMs) * 100) : 0;

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || durationMs <= 0) return;
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(clientX - r.left, 0), r.width);
      const ms = (x / r.width) * durationMs;
      try {
        player.goto(ms, playing);
      } catch {
        /* ignore */
      }
      requestAnimationFrame(() => syncNow());
    },
    [durationMs, player, playing, syncNow],
  );

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scrubMovedRef.current) {
      scrubMovedRef.current = false;
      return;
    }
    seekFromClientX(e.clientX);
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    scrubMovedRef.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    seekFromClientX(e.clientX);
  };

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    scrubMovedRef.current = true;
    seekFromClientX(e.clientX);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      try {
        player.goto(Math.min(durationMs, currentMs + 5000), playing);
      } catch {
        /* ignore */
      }
      requestAnimationFrame(() => syncNow());
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      try {
        player.goto(Math.max(0, currentMs - 5000), playing);
      } catch {
        /* ignore */
      }
      requestAnimationFrame(() => syncNow());
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Seek — drag on the bar, or arrow keys for 5 seconds"
      aria-valuemin={0}
      aria-valuemax={durationMs}
      aria-valuenow={Math.round(currentMs)}
      className={cn(
        'relative flex h-4 w-full min-w-0 cursor-pointer touch-none items-center outline-none',
        'rounded-full focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900',
      )}
      onClick={onTrackClick}
      onPointerDown={onTrackPointerDown}
      onPointerMove={onTrackPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onTrackKeyDown}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-zinc-700/50" />
      <div
        className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.12)]"
        style={{ width: `${pct}%`, maxWidth: '100%' }}
      />
      <div
        className="pointer-events-none absolute top-1/2 z-[1] h-3.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-900 bg-white shadow-sm"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

/** Play / seek / speed / fullscreen — stays under the player. */
function SessionReplayTransportBar({
  player,
  durationMs,
}: {
  player: PlayerInstance;
  durationMs: number;
}) {
  const { currentMs, playing, syncNow } = useReplayPlayback();
  const [speed, setSpeed] = useState(1);
  const [skipInactive, setSkipInactive] = useState(true);

  const seekRel = (deltaMs: number) => {
    const next = Math.min(durationMs, Math.max(0, currentMs + deltaMs));
    try {
      player.goto(next, playing);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => syncNow());
  };

  return (
    <div className="w-full shrink-0 border-t border-zinc-800/80 bg-zinc-900/90 px-2.5 py-1.5 sm:px-3 sm:py-2">
      <div className="flex min-h-[2.25rem] items-center gap-1.5 sm:gap-2">
        <div className="flex shrink-0 items-center gap-px">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:w-8"
            aria-label="Back 10 seconds"
            title="Back 10s"
            onClick={() => seekRel(-SEEK_STEP_MS)}
          >
            <Rewind className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => {
              try {
                player.toggle();
              } catch {
                /* ignore */
              }
            }}
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:w-8"
            aria-label="Forward 10 seconds"
            title="Forward 10s"
            onClick={() => seekRel(SEEK_STEP_MS)}
          >
            <FastForward className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="min-w-0 flex-1 px-0.5">
          <ReplayScrubberTrack player={player} durationMs={durationMs} />
        </div>

        <span className="w-[4.25rem] shrink-0 text-right tabular-nums text-[10px] text-zinc-500 sm:w-auto sm:text-[11px]">
          <span className="font-medium text-zinc-200">{fmtClock(currentMs)}</span>
          <span className="mx-0.5 text-zinc-600">/</span>
          <span>{fmtClock(durationMs)}</span>
        </span>

        <div className="flex shrink-0 items-center gap-px border-l border-zinc-800/80 pl-1.5 sm:pl-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 shrink-0 rounded-lg text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:w-8',
              skipInactive && 'bg-white/[0.07] text-zinc-200',
            )}
            aria-label={skipInactive ? 'Skip idle time (on)' : 'Skip idle time (off)'}
            title={skipInactive ? 'Skip idle: on' : 'Skip idle: off'}
            onClick={() => {
              try {
                player.toggleSkipInactive();
                setSkipInactive((s) => !s);
              } catch {
                /* ignore */
              }
            }}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-0.5 rounded-lg px-1.5 text-[10px] font-medium tabular-nums text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:px-2 sm:text-[11px]"
                aria-label="Playback speed"
                title="Speed"
              >
                <Gauge className="h-3 w-3 opacity-80" />
                {speed}×
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[6.5rem] rounded-lg border-zinc-700 bg-zinc-900">
              {SPEED_OPTIONS.map((s) => (
                <DropdownMenuItem
                  key={s}
                  className="rounded-lg text-xs tabular-nums"
                  onClick={() => {
                    try {
                      player.setSpeed(s);
                      setSpeed(s);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {s}×{s === 1 ? ' normal' : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:w-8"
            aria-label="Fullscreen"
            title="Fullscreen"
            onClick={() => {
              try {
                player.toggleFullscreen();
              } catch {
                /* ignore */
              }
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SessionReplaySurface({
  events,
  customEvents,
  onReady,
  onBridgeReady,
  sessionSummary,
  websiteId,
  knownDurationMs,
  className,
}: {
  events: RRWebEvent[];
  customEvents?: SessionCustomEvent[];
  onReady?: (api: SessionReplaySurfaceAPI) => void;
  onBridgeReady?: (bridge: SessionReplayBridge | null) => void;
  /** Fields from session API meta for the timeline log. */
  sessionSummary?: { entryPage?: string; hasErrors?: boolean; hasRageClicks?: boolean };
  /** Used to normalize dashboard URLs in the timeline and session summary. */
  websiteId?: string;
  /**
   * Known total duration from session metadata. Used to size the scrubber
   * correctly before all streaming chunks arrive.
   */
  knownDurationMs?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  /** Unpadded box — ResizeObserver contentRect matches space available for the player */
  const measureInnerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onBridgeReadyRef = useRef(onBridgeReady);
  onBridgeReadyRef.current = onBridgeReady;
  /** Impl set when player mounts; cleared on destroy. Appends events without re-mounting. */
  const addEventsImplRef = useRef<((evs: RRWebEvent[]) => void) | null>(null);

  const [bridge, setBridge] = useState<{ player: PlayerInstance; replayer: SessionReplayerCore } | null>(null);
  /** Start small until ResizeObserver runs — avoids a huge iframe flash before the first layout pass. */
  const [playerSize, setPlayerSize] = useState({ w: 640, h: 360 });
  /** Grows as streaming chunks extend the timeline beyond the initial event set. */
  const [streamedDurationMs, setStreamedDurationMs] = useState(0);

  const durationMs = useMemo(() => {
    const fromEvents = events.length < 2
      ? 0
      : Math.max(0, events[events.length - 1].timestamp - events[0].timestamp);
    return Math.max(fromEvents, streamedDurationMs, knownDurationMs ?? 0);
  }, [events, streamedDurationMs, knownDurationMs]);

  const t0 = events.length > 0 ? events[0].timestamp : 0;

  const activityStats = useMemo(() => buildSessionActivityStats(events), [events]);

  const errorDetails = useMemo(
    () => buildSessionErrorDetails(customEvents ?? [], t0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customEvents, t0],
  );

  const consoleDetails = useMemo(
    () => buildConsoleDetails(customEvents ?? [], t0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customEvents, t0],
  );

  const networkDetails = useMemo(
    () => buildNetworkDetails(customEvents ?? [], t0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customEvents, t0],
  );

  const timelineMarkers = useMemo(() => buildReplayTimelineMarkers(events), [events]);

  const logEntries = useMemo(
    () =>
      buildReplayLogEntries(events, {
        entryPage: sessionSummary?.entryPage,
        hasErrors: Boolean(sessionSummary?.hasErrors),
        hasRageClicks: Boolean(sessionSummary?.hasRageClicks),
        websiteId,
        errorDetails,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, sessionSummary?.entryPage, sessionSummary?.hasErrors, sessionSummary?.hasRageClicks, websiteId, errorDetails],
  );

  useLayoutEffect(() => {
    const notify = onBridgeReadyRef.current;
    if (!notify) return;
    if (bridge && events.length > 0) {
      notify({
        player: bridge.player,
        replayer: bridge.replayer,
        durationMs,
        markers: timelineMarkers,
        logEntries,
        activityStats,
        errorDetails,
        consoleDetails,
        networkDetails,
      });
    } else {
      notify(null);
    }
  }, [bridge, durationMs, timelineMarkers, logEntries, activityStats, errorDetails, consoleDetails, networkDetails, events.length]);

  useEffect(() => {
    return () => {
      onBridgeReadyRef.current?.(null);
    };
  }, []);

  useLayoutEffect(() => {
    const el = measureInnerRef.current;
    if (!el) return;

    let raf = 0;

    const apply = (width: number, height: number) => {
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      setPlayerSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    const schedule = (width: number, height: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        apply(width, height);
      });
    };

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      schedule(cr.width, cr.height);
    });
    ro.observe(el);
    const { clientWidth, clientHeight } = el;
    apply(clientWidth, clientHeight);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!bridge) return;
    const r = bridge.replayer as unknown as {
      iframe: HTMLIFrameElement;
      wrapper: HTMLElement;
      on: (ev: string, fn: (payload?: unknown) => void) => void;
      off: (ev: string, fn: (payload?: unknown) => void) => void;
    };

    let lastResizeDims: { width?: number; height?: number } | undefined;
    let coverRaf = 0;

    const scheduleCover = () => {
      cancelAnimationFrame(coverRaf);
      coverRaf = requestAnimationFrame(() => {
        coverRaf = 0;
        const shell = shellRef.current;
        if (!shell) return;
        applyReplayCoverScale(r, shell.clientWidth, shell.clientHeight, PLAYER_MAX_SCALE, lastResizeDims);
      });
    };

    const sync = (d?: { width?: number; height?: number }) => {
      lastResizeDims = d;
      scheduleCover();
    };

    const onResize = (payload?: unknown) => sync(payload as { width?: number; height?: number } | undefined);

    sync();
    r.on('resize', onResize);
    const t1 = window.setTimeout(() => sync(), 0);
    const t2 = window.setTimeout(() => sync(), 160);

    return () => {
      cancelAnimationFrame(coverRaf);
      clearTimeout(t1);
      clearTimeout(t2);
      r.off('resize', onResize);
    };
  }, [bridge]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || events.length === 0) return;

    let cancelled = false;

    (async () => {
      const { default: RPlayer } = await import('rrweb-player');
      if (cancelled || !shellRef.current) return;

      shell.innerHTML = '';
      const mount = document.createElement('div');
      mount.className = 'rrweb-player-root';
      shell.appendChild(mount);

      const innerBox = measureInnerRef.current;
      const w = innerBox
        ? Math.max(1, Math.floor(innerBox.clientWidth))
        : playerSize.w;
      const h = innerBox
        ? Math.max(1, Math.floor(innerBox.clientHeight))
        : playerSize.h;

      const player = new RPlayer({
        target: mount,
        props: {
          events: events as never,
          width: w,
          height: h,
          autoPlay: true,
          speed: 1,
          speedOption: [...SPEED_OPTIONS],
          skipInactive: true,
          showController: false,
          maxScale: PLAYER_MAX_SCALE,
          inactiveColor: 'rgba(255, 255, 255, 0.18)',
          // Noisy on inconsistent recordings; DevTools console work can spike CPU/fan.
          showWarning: false,
          showDebug: false,
          mouseTail: false,
        },
      });

      playerRef.current = player;
      const replayer = player.getReplayer() as SessionReplayerCore & {
        addEvent?: (ev: unknown) => void;
      };
      setBridge({ player, replayer });

      const t0 = events.length > 0 ? events[0].timestamp : 0;
      addEventsImplRef.current = (newEvs: RRWebEvent[]) => {
        if (!replayer.addEvent || newEvs.length === 0) return;
        for (const ev of newEvs) {
          try { replayer.addEvent(ev); } catch { /* ignore — stale replayer */ }
        }
        if (t0 > 0) {
          const lastTs = newEvs[newEvs.length - 1].timestamp;
          setStreamedDurationMs(prev => Math.max(prev, lastTs - t0));
        }
      };

      requestAnimationFrame(() => {
        try {
          player.triggerResize();
        } catch {
          /* ignore */
        }
      });
      window.setTimeout(() => {
        try {
          player.triggerResize();
        } catch {
          /* ignore */
        }
      }, 120);
      // Ensure playback starts after mount (autoPlay alone is sometimes deferred)
      window.setTimeout(() => {
        try {
          (player as { play?: () => void }).play?.();
        } catch {
          /* ignore */
        }
      }, 0);

      onReadyRef.current?.({
        goto: (offsetMs, shouldPlay = false) => {
          try {
            player.goto(offsetMs, shouldPlay);
          } catch {
            /* ignore */
          }
        },
        toggle: () => {
          try {
            player.toggle();
          } catch {
            /* ignore */
          }
        },
        toggleFullscreen: () => {
          try {
            player.toggleFullscreen();
          } catch {
            /* ignore */
          }
        },
        addEvents: (evs: RRWebEvent[]) => addEventsImplRef.current?.(evs),
      });

    })();

    return () => {
      cancelled = true;
      addEventsImplRef.current = null;
      setBridge(null);
      setStreamedDurationMs(0);
      try {
        (playerRef.current as { $destroy?: () => void } | null)?.$destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [events]);

  useEffect(() => {
    if (!bridge) return;
    const p = playerRef.current as
      | (PlayerInstance & { $set?: (props: { width?: number; height?: number }) => void })
      | null;
    if (!p) return;
    try {
      p.$set?.({ width: playerSize.w, height: playerSize.h });
      p.triggerResize();
    } catch {
      /* ignore */
    }
    const rep = bridge.replayer as unknown as { wrapper: HTMLElement; iframe: HTMLIFrameElement };
    let coverRaf = 0;
    const scheduleCover = () => {
      cancelAnimationFrame(coverRaf);
      coverRaf = requestAnimationFrame(() => {
        coverRaf = 0;
        const shell = shellRef.current;
        if (!shell) return;
        applyReplayCoverScale(rep, shell.clientWidth, shell.clientHeight, PLAYER_MAX_SCALE);
      });
    };
    scheduleCover();
    const t1 = window.setTimeout(scheduleCover, 50);
    return () => {
      cancelAnimationFrame(coverRaf);
      window.clearTimeout(t1);
    };
  }, [bridge, playerSize.w, playerSize.h]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'flex w-full min-w-0 max-w-full flex-col',
        className,
      )}
    >
      <div
        className="mx-auto w-full flex min-h-0 min-w-0 flex-col overflow-hidden mb-4 rounded-lg border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]"
        style={{ maxWidth: 'calc(68dvh * 16 / 9)' }}
      >
        <div ref={measureRef} className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div
            ref={measureInnerRef}
            className="relative min-h-0 min-w-0 w-full overflow-hidden bg-black"
            style={{ aspectRatio: '16/9', maxHeight: '68dvh' }}
          >
            <div
              ref={shellRef}
              className={cn(
                'absolute inset-0 overflow-hidden rounded-t-xl bg-black',
                'outline outline-1 -outline-offset-1 outline-white/[0.06]',
                '[&_.rrweb-player-root]:h-full [&_.rrweb-player-root]:w-full [&_.rrweb-player-root]:flow-root',
                '[&_.rr-player]:!float-none [&_.rr-player]:!m-0 [&_.rr-player]:!block [&_.rr-player]:!rounded-none [&_.rr-player]:!border-0 [&_.rr-player]:!bg-transparent [&_.rr-player]:!shadow-none [&_.rr-player]:!ring-0 [&_.rr-player]:!outline-none',
                '[&_.rr-player__frame]:!relative [&_.rr-player__frame]:!overflow-hidden [&_.rr-player__frame]:!rounded-[inherit] [&_.rr-player__frame]:!border-0 [&_.rr-player__frame]:!bg-black [&_.rr-player__frame]:!shadow-none [&_.rr-player__frame]:!ring-0 [&_.rr-player__frame]:!outline-none',
                '[&_.replayer-wrapper]:!absolute [&_.replayer-wrapper]:!left-1/2 [&_.replayer-wrapper]:!top-0 [&_.replayer-wrapper]:!float-none [&_.replayer-wrapper]:!clear-none [&_.replayer-wrapper]:!origin-top [&_.replayer-wrapper]:!border-0 [&_.replayer-wrapper]:!ring-0',
                '[&_.replayer-wrapper>iframe]:!border-0 [&_.replayer-wrapper>iframe]:!bg-black [&_.replayer-wrapper>iframe]:!shadow-none',
              )}
            />
          </div>
        </div>
        {bridge && <SessionReplayTransportBar player={bridge.player} durationMs={durationMs} />}
      </div>
    </div>
  );
}
