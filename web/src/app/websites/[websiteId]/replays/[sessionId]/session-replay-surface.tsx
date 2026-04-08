'use client';

import 'rrweb/dist/style.css';
import 'rrweb-player/dist/style.css';

import { useEffect, useLayoutEffect, useRef, useMemo, useCallback, useState } from 'react';
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
import { FastForward, Gauge, Maximize2, Pause, Play, Rewind, SkipForward } from 'lucide-react';
import type { RRWebEvent } from '@/lib/replays-api';

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

/**
 * rrweb-player caps scale with Math.min(widthScale, heightScale, maxScale).
 * maxScale: 1 prevents upscaling, so small recordings stay tiny in the frame and in fullscreen.
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

/** Largest size that fits stage while matching capture aspect — centers cleanly with even side/top space. */
function fitPlayerSize(stageW: number, stageH: number, aspectRatio: number): { w: number; h: number } {
  const sw = Math.max(0, stageW);
  const sh = Math.max(0, stageH);
  if (sw < 4 || sh < 4) {
    return { w: 320, h: Math.max(1, Math.round(320 / aspectRatio)) };
  }
  let w = Math.floor(sw);
  let h = Math.round(w / aspectRatio);
  if (h > sh) {
    h = Math.floor(sh);
    w = Math.round(h * aspectRatio);
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

type PlayerInstance = InstanceType<typeof PlayerCtor>;

/** Minimal surface of rrweb Replayer for our chrome (avoids duplicate rrweb type graphs). */
type ReplayCore = {
  getCurrentTime: () => number;
  on: (ev: string, fn: (payload: unknown) => void) => void;
  off: (ev: string, fn: (payload: unknown) => void) => void;
};

function ReplayControlBar({
  player,
  replayer,
  durationMs,
  onPlaybackMs,
}: {
  player: PlayerInstance;
  replayer: ReplayCore;
  durationMs: number;
  onPlaybackMs?: (ms: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [skipInactive, setSkipInactive] = useState(true);

  useEffect(() => {
    const handler = (payload: unknown) => {
      const p = payload as { player?: { value: string } };
      const v = p.player?.value;
      if (v === 'playing') setPlaying(true);
      if (v === 'paused') setPlaying(false);
    };
    replayer.on('state-change', handler);
    try {
      const v = (replayer as { service?: { state?: { value: string } } }).service?.state?.value;
      setPlaying(v === 'playing');
    } catch {
      /* ignore */
    }
    return () => {
      try {
        replayer.off('state-change', handler);
      } catch {
        /* ignore */
      }
    };
  }, [replayer]);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      try {
        const t = Math.min(durationMs, Math.max(0, replayer.getCurrentTime()));
        setCurrentMs(t);
        onPlaybackMs?.(t);
      } catch {
        /* ignore */
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [replayer, durationMs, onPlaybackMs]);

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
    },
    [durationMs, player, playing],
  );

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    seekFromClientX(e.clientX);
  };

  const onTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      try {
        player.goto(Math.min(durationMs, currentMs + 5000), playing);
      } catch {
        /* ignore */
      }
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      try {
        player.goto(Math.max(0, currentMs - 5000), playing);
      } catch {
        /* ignore */
      }
    }
  };

  const seekRel = (deltaMs: number) => {
    const next = Math.min(durationMs, Math.max(0, currentMs + deltaMs));
    try {
      player.goto(next, playing);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-full shrink-0 border-t border-border bg-card px-3 py-3 sm:px-4">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={Math.round(currentMs)}
        className="group relative mb-3 h-2.5 w-full max-w-full cursor-pointer rounded-full bg-muted/80 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={onTrackClick}
        onKeyDown={onTrackKeyDown}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-center">
        <div className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Back 10 seconds"
            onClick={() => seekRel(-SEEK_STEP_MS)}
          >
            <Rewind className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full shadow-sm"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => {
              try {
                player.toggle();
              } catch {
                /* ignore */
              }
            }}
          >
            {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 ml-0.5 fill-current" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Forward 10 seconds"
            onClick={() => seekRel(SEEK_STEP_MS)}
          >
            <FastForward className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 min-w-[4.75rem] tabular-nums text-center text-[11px] text-muted-foreground sm:text-xs">
            <span className="text-foreground">{fmtClock(currentMs)}</span>
            <span className="mx-0.5 opacity-40">/</span>
            {fmtClock(durationMs)}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-1 rounded-full px-3 text-[11px] text-muted-foreground',
              skipInactive && 'bg-background/80 shadow-sm',
            )}
            onClick={() => {
              try {
                player.toggleSkipInactive();
                setSkipInactive((s) => !s);
              } catch {
                /* ignore */
              }
            }}
          >
            <SkipForward className="h-3 w-3" />
            <span className="hidden sm:inline">Idle</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-3 text-[11px]">
                <Gauge className="h-3 w-3" />
                {speed}×
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[6.5rem] rounded-xl">
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
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
            aria-label="Fullscreen"
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
  onPlaybackMs,
  className,
}: {
  events: RRWebEvent[];
  onReady?: (api: SessionReplaySurfaceAPI) => void;
  onPlaybackMs?: (ms: number) => void;
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

  const [bridge, setBridge] = useState<{ player: PlayerInstance; replayer: ReplayCore } | null>(null);
  const [playerSize, setPlayerSize] = useState({ w: 1300, h: 675 });

  const metaAspect = useMemo(() => replayViewportRatio(events), [events]);
  const [contentAspect, setContentAspect] = useState(metaAspect);

  useEffect(() => {
    setContentAspect(metaAspect);
  }, [metaAspect]);

  const durationMs = useMemo(() => {
    if (events.length < 2) return 0;
    return Math.max(0, events[events.length - 1].timestamp - events[0].timestamp);
  }, [events]);

  useLayoutEffect(() => {
    const el = measureInnerRef.current;
    if (!el) return;

    let debounceT: ReturnType<typeof setTimeout> | undefined;

    const apply = (width: number, height: number) => {
      const next = fitPlayerSize(width, height, contentAspect);
      setPlayerSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      clearTimeout(debounceT);
      debounceT = setTimeout(() => apply(cr.width, cr.height), 60);
    });
    ro.observe(el);
    const r0 = el.getBoundingClientRect();
    apply(r0.width, r0.height);
    return () => {
      clearTimeout(debounceT);
      ro.disconnect();
    };
  }, [contentAspect]);

  useEffect(() => {
    if (!bridge) return;
    const r = bridge.replayer as unknown as {
      iframe: HTMLIFrameElement;
      on: (ev: string, fn: (payload?: unknown) => void) => void;
      off: (ev: string, fn: (payload?: unknown) => void) => void;
    };

    const sync = (d?: { width?: number; height?: number }) => {
      const w = Number(d?.width) || r.iframe.offsetWidth;
      const h = Number(d?.height) || r.iframe.offsetHeight;
      if (w > 0 && h > 0) setContentAspect(w / h);
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

      const w = playerSize.w;
      const h = playerSize.h;

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
      const replayer = player.getReplayer() as ReplayCore;
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
  }, [events, playerSize.w, playerSize.h]);

  return (
    <div
      ref={wrapRef}
      className={cn('mt-2 flex min-h-0 w-full min-w-0 flex-1 flex-col sm:mt-3 p-4', className)}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border ">
        <div
          ref={measureRef}
          className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col "
        >
          <div
            ref={measureInnerRef}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center"
          >
            <div
              ref={shellRef}
              style={{ width: playerSize.w, height: playerSize.h }}
              className={cn(
                'relative shrink-0 overflow-hidden rounded-xl bg-black',
                '[&_.rrweb-player-root]:h-full [&_.rrweb-player-root]:w-full [&_.rrweb-player-root]:flow-root',
                '[&_.rr-player]:!float-none [&_.rr-player]:!m-0 [&_.rr-player]:!block [&_.rr-player]:!rounded-none [&_.rr-player]:!border-0 [&_.rr-player]:!bg-transparent [&_.rr-player]:!shadow-none [&_.rr-player]:!ring-0 [&_.rr-player]:!outline-none',
                '[&_.rr-player__frame]:!relative [&_.rr-player__frame]:!overflow-hidden [&_.rr-player__frame]:!rounded-xl [&_.rr-player__frame]:!border-0 [&_.rr-player__frame]:!bg-black [&_.rr-player__frame]:!shadow-none [&_.rr-player__frame]:!ring-0 [&_.rr-player__frame]:!outline-none',
                '[&_.replayer-wrapper]:!absolute [&_.replayer-wrapper]:!left-1/2 [&_.replayer-wrapper]:!top-1/2 [&_.replayer-wrapper]:!float-none [&_.replayer-wrapper]:!clear-none [&_.replayer-wrapper]:!origin-top-left [&_.replayer-wrapper]:!border-0 [&_.replayer-wrapper]:!ring-0',
                '[&_.replayer-wrapper>iframe]:!border-0 [&_.replayer-wrapper>iframe]:!bg-black [&_.replayer-wrapper>iframe]:!shadow-none',
              )}
            />
          </div>
        </div>
        {bridge && (
          <ReplayControlBar
            player={bridge.player}
            replayer={bridge.replayer}
            durationMs={durationMs}
            onPlaybackMs={onPlaybackMs}
          />
        )}
      </div>
    </div>
  );
}
