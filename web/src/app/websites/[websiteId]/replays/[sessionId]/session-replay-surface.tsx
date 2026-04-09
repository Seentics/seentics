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
import type { RRWebEvent } from '@/lib/replays-api';

type PlayerInstance = InstanceType<typeof PlayerCtor>;

export type SessionReplaySurfaceAPI = {
  goto: (offsetMs: number, shouldPlay?: boolean) => void;
  toggle: () => void;
  toggleFullscreen: () => void;
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
  /** Playback offset in ms; null when we can’t seek (e.g. error without timestamp). */
  offsetMs: number | null;
};

const LOG_KIND_ORDER: Record<ReplayLogEntryKind, number> = {
  start: 0,
  page: 1,
  rage: 2,
  error: 3,
};

function shortenTimelineLabel(raw: string, max = 56): string {
  const t = raw?.trim() || '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
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
 * Ordered log of notable moments: start, page/full snapshots, rage clusters, and optional client error flag.
 */
export function buildReplayLogEntries(
  events: RRWebEvent[],
  opts?: { entryPage?: string; hasErrors?: boolean; hasRageClicks?: boolean },
): ReplayLogEntry[] {
  if (events.length < 2) return [];
  const t0 = events[0].timestamp;
  const out: ReplayLogEntry[] = [];

  out.push({
    id: 'start',
    kind: 'start',
    title: 'Recording start',
    detail: opts?.entryPage ? shortenTimelineLabel(opts.entryPage) : undefined,
    offsetMs: 0,
  });

  let pageSeq = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type !== RRWEB_FULL) continue;
    const off = events[i].timestamp - t0;
    const href = hrefAfterFullSnapshot(events, i);
    if (off <= 0) {
      if (href) {
        out[0] = {
          ...out[0],
          detail: shortenTimelineLabel(href),
        };
      }
      continue;
    }
    pageSeq += 1;
    out.push({
      id: `page-${pageSeq}-${off}`,
      kind: 'page',
      title: 'Page / full snapshot',
      detail: href
        ? shortenTimelineLabel(href)
        : 'New DOM snapshot (navigation or major in-app change)',
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

  if (opts?.hasErrors) {
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
          'flex flex-col items-center justify-center border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center',
          embedded ? 'rounded-md' : 'rounded-xl',
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
          ? 'rounded-md border border-border/60 bg-muted/20'
          : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm',
      )}
    >
      <ul
        className={cn(
          !embedded &&
            'min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]',
        )}
      >
        {entries.map((e) => {
          const canSeek = e.offsetMs !== null && durationMs > 0;
          const active =
            canSeek &&
            e.offsetMs !== null &&
            Math.abs(currentMs - e.offsetMs) < 2800;
          const timeLabel =
            e.offsetMs === null ? '—' : fmtClock(Math.min(durationMs, Math.max(0, e.offsetMs)));

          return (
            <li key={e.id} className="border-b border-border/50 last:border-b-0">
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
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{e.title}</span>
                  {e.detail ? (
                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                      {e.detail}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{timeLabel}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/**
 * rrweb-player uses Math.min(widthScale, heightScale) (letterbox / “contain”).
 * We override `.replayer-wrapper` transform to fill the shell (“cover”) and clip overflow.
 */
const PLAYER_MAX_SCALE = 100;

function replayViewportRatio(events: RRWebEvent[]): number {
  for (const ev of events) {
    if (ev.type !== RRWEB_META) continue;
    const d = ev.data as { width?: unknown; height?: unknown };
    const w = Number(d?.width);
    const h = Number(d?.height);
    if (w > 0 && h > 0) return w / h;
  }
  return 16 / 9;
}

function readReplayerLogicalSize(
  replayer: { wrapper: HTMLElement; iframe: HTMLIFrameElement },
  resizePayload?: { width?: number; height?: number },
): { w: number; h: number } {
  const pw = Number(resizePayload?.width);
  const ph = Number(resizePayload?.height);
  if (pw > 1 && ph > 1) return { w: pw, h: ph };

  try {
    const doc = replayer.iframe.contentDocument;
    const root = doc?.documentElement;
    if (root) {
      const w = Math.max(root.scrollWidth, root.clientWidth);
      const h = Math.max(root.scrollHeight, root.clientHeight);
      if (w > 1 && h > 1) return { w, h };
    }
  } catch {
    /* cross-origin or not ready */
  }

  const w = replayer.iframe.offsetWidth;
  const h = replayer.iframe.offsetHeight;
  return { w, h };
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
  const scale = Math.min(maxScale, Math.max(widthScale, heightScale));
  replayer.wrapper.style.transform = `scale(${scale}) translate(-50%, -50%)`;
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
            className="h-7 w-7 shrink-0 rounded-md text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:w-8"
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
            className="h-7 w-7 shrink-0 rounded-md text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:w-8"
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
              'h-7 w-7 shrink-0 rounded-md text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:w-8',
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
                className="h-7 gap-0.5 rounded-md px-1.5 text-[10px] font-medium tabular-nums text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:px-2 sm:text-[11px]"
                aria-label="Playback speed"
                title="Speed"
              >
                <Gauge className="h-3 w-3 opacity-80" />
                {speed}×
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[6.5rem] rounded-xl border-zinc-700 bg-zinc-900">
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
            className="h-7 w-7 shrink-0 rounded-md text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 sm:h-8 sm:w-8"
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
  onReady,
  onBridgeReady,
  sessionSummary,
  className,
}: {
  events: RRWebEvent[];
  onReady?: (api: SessionReplaySurfaceAPI) => void;
  onBridgeReady?: (bridge: SessionReplayBridge | null) => void;
  /** Fields from session API meta for the timeline log. */
  sessionSummary?: { entryPage?: string; hasErrors?: boolean; hasRageClicks?: boolean };
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

  const [bridge, setBridge] = useState<{ player: PlayerInstance; replayer: SessionReplayerCore } | null>(null);
  /** Start small until ResizeObserver runs — avoids a huge iframe flash before the first layout pass. */
  const [playerSize, setPlayerSize] = useState({ w: 640, h: 360 });

  const metaAspect = useMemo(() => replayViewportRatio(events), [events]);
  const [, setContentAspect] = useState(metaAspect);

  useEffect(() => {
    setContentAspect(metaAspect);
  }, [metaAspect]);

  const durationMs = useMemo(() => {
    if (events.length < 2) return 0;
    return Math.max(0, events[events.length - 1].timestamp - events[0].timestamp);
  }, [events]);

  const timelineMarkers = useMemo(() => buildReplayTimelineMarkers(events), [events]);

  const logEntries = useMemo(
    () =>
      buildReplayLogEntries(events, {
        entryPage: sessionSummary?.entryPage,
        hasErrors: Boolean(sessionSummary?.hasErrors),
        hasRageClicks: Boolean(sessionSummary?.hasRageClicks),
      }),
    [events, sessionSummary?.entryPage, sessionSummary?.hasErrors, sessionSummary?.hasRageClicks],
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
      });
    } else {
      notify(null);
    }
  }, [bridge, durationMs, timelineMarkers, logEntries, events.length]);

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

    const applyCover = () => {
      const shell = shellRef.current;
      if (!shell) return;
      applyReplayCoverScale(
        r,
        shell.clientWidth,
        shell.clientHeight,
        PLAYER_MAX_SCALE,
        lastResizeDims,
      );
    };

    const sync = (d?: { width?: number; height?: number }) => {
      lastResizeDims = d;
      const { w, h } = readReplayerLogicalSize(r, d);
      if (w > 0 && h > 0) setContentAspect(w / h);
      queueMicrotask(applyCover);
      requestAnimationFrame(applyCover);
    };

    const onResize = (payload?: unknown) => sync(payload as { width?: number; height?: number } | undefined);

    sync();
    r.on('resize', onResize);
    const t1 = window.setTimeout(() => sync(), 0);
    const t2 = window.setTimeout(() => sync(), 160);

    return () => {
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
        },
      });

      playerRef.current = player;
      const replayer = player.getReplayer() as SessionReplayerCore;
      setBridge({ player, replayer });

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
      });

    })();

    return () => {
      cancelled = true;
      setBridge(null);
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
    const shell = shellRef.current;
    const runCover = () => {
      if (!shell) return;
      applyReplayCoverScale(rep, shell.clientWidth, shell.clientHeight, PLAYER_MAX_SCALE);
    };
    queueMicrotask(runCover);
    const raf = requestAnimationFrame(runCover);
    const t0 = window.setTimeout(runCover, 0);
    const t1 = window.setTimeout(runCover, 50);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [bridge, playerSize.w, playerSize.h]);

  useEffect(() => {
    if (!bridge || !shellRef.current) return;
    const rep = bridge.replayer as unknown as { wrapper: HTMLElement; iframe: HTMLIFrameElement };
    const shell = shellRef.current;
    const run = () => applyReplayCoverScale(rep, shell.clientWidth, shell.clientHeight, PLAYER_MAX_SCALE);
    run();
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [bridge, playerSize.w, playerSize.h]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'flex w-full min-w-0 flex-1 flex-col',
        className,
        'min-h-[89dvh]',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden mb-4  border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]">
        <div ref={measureRef} className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
          <div
            ref={measureInnerRef}
            className="relative min-h-0 w-full min-w-0 flex-1 basis-0 bg-black"
          >
            <div
              ref={shellRef}
              className={cn(
                'absolute inset-0 overflow-hidden rounded-lg bg-black',
                'outline outline-1 -outline-offset-1 outline-white/[0.06]',
                '[&_.rrweb-player-root]:h-full [&_.rrweb-player-root]:w-full [&_.rrweb-player-root]:flow-root',
                '[&_.rr-player]:!float-none [&_.rr-player]:!m-0 [&_.rr-player]:!block [&_.rr-player]:!rounded-none [&_.rr-player]:!border-0 [&_.rr-player]:!bg-transparent [&_.rr-player]:!shadow-none [&_.rr-player]:!ring-0 [&_.rr-player]:!outline-none',
                '[&_.rr-player__frame]:!relative [&_.rr-player__frame]:!overflow-hidden [&_.rr-player__frame]:!rounded-[inherit] [&_.rr-player__frame]:!border-0 [&_.rr-player__frame]:!bg-black [&_.rr-player__frame]:!shadow-none [&_.rr-player__frame]:!ring-0 [&_.rr-player__frame]:!outline-none',
                '[&_.replayer-wrapper]:!absolute [&_.replayer-wrapper]:!left-1/2 [&_.replayer-wrapper]:!top-1/2 [&_.replayer-wrapper]:!float-none [&_.replayer-wrapper]:!clear-none [&_.replayer-wrapper]:!origin-top-left [&_.replayer-wrapper]:!border-0 [&_.replayer-wrapper]:!ring-0',
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
