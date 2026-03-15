'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, RefreshCw, Play, Pause, SkipBack, SkipForward, Maximize, Minimize,
  FastForward
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { isDemo } from '@/lib/demo';

interface ReplayPlayerProps {
  sessionId: string;
  websiteId: string;
  session?: {
    session_id: string;
    browser?: string;
    device?: string;
    os?: string;
    country?: string;
    entry_page?: string;
    duration_seconds?: number;
    chunk_count?: number;
    start_time?: string;
  } | null;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const SPEED_OPTIONS = [1, 2, 4, 8];

export default function ReplayPlayer({ sessionId, websiteId, session }: ReplayPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<rrwebPlayer | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [streamProgress, setStreamProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
  const pendingChunksRef = useRef<any[][]>([]);
  const appendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(() => (session?.duration_seconds ?? 0) * 1000);
  const [speed, setSpeed] = useState(1);
  const [skipInactive, setSkipInactive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for timer interpolation (avoids re-renders)
  const isPlayingRef = useRef(false);
  const finishedRef = useRef(false);
  const speedRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const hasFullSnapshot = (evts: any[]) => evts.some((e: any) => e.type === 2);

    const fetchChunk = async (url: string): Promise<any[]> => {
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) {
          console.warn('[ReplayPlayer] Chunk fetch failed:', res.status, url.slice(0, 80));
          return [];
        }
        const text = await res.text();
        if (!text) return [];
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn('[ReplayPlayer] Chunk parse error:', err);
        return [];
      }
    };

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setEvents([]);
        setStreamProgress({ loaded: 0, total: 0 });

        // Demo mode: skip loading real data, render placeholder player
        if (isDemo(websiteId)) {
          setLoading(false);
          return;
        }

        // ── Step 1: Get presigned manifest ──
        let allEvents: any[] = [];
        let fullURL: string | undefined;

        try {
          const manifestRes = await api.get(
            `/replays/presigned-manifest/${sessionId}?website_id=${websiteId}`,
            { signal, timeout: 20000 },
          );
          const manifest = manifestRes.data;
          const chunks: { seq: number; url: string }[] = manifest?.chunks ?? [];
          const totalChunks = manifest?.total_chunks ?? chunks.length;
          fullURL = manifest?.full_url;

          if (signal.aborted) return;

          // ── Step 2: Try stitched full URL first (fastest for short sessions) ──
          if (fullURL && totalChunks <= 3) {
            try {
              const s3Res = await fetch(fullURL, { signal });
              if (s3Res.ok) {
                const data = await s3Res.json();
                if (Array.isArray(data) && data.length > 0 && hasFullSnapshot(data)) {
                  setEvents(data);
                  setStreamProgress({ loaded: totalChunks, total: totalChunks });
                  return;
                }
              }
            } catch {}
          }

          // ── Step 3: Load first 3 chunks, start playback, then background-fetch rest ──
          if (chunks.length > 0) {
            setStreamProgress({ loaded: 0, total: totalChunks });
            const sorted = [...chunks].sort((a, b) => a.seq - b.seq);
            const initialCount = Math.min(3, sorted.length);

            // Load first 3 chunks sequentially to start playback fast
            const initialEvents: any[] = [];
            for (let i = 0; i < initialCount; i++) {
              if (signal.aborted) return;
              const chunkEvents = await fetchChunk(sorted[i].url);
              if (chunkEvents.length) initialEvents.push(...chunkEvents);
              setStreamProgress({ loaded: i + 1, total: totalChunks });
            }

            if (signal.aborted) return;

            if (initialEvents.length > 0 && hasFullSnapshot(initialEvents)) {
              // Start playback immediately with the first 3 chunks
              allEvents = initialEvents;
              pendingChunksRef.current = [];
              setEvents(initialEvents);
              setLoading(false);

              // Background-fetch remaining chunks and append them
              if (sorted.length > initialCount) {
                const remaining = sorted.slice(initialCount);
                let bgLoaded = initialCount;

                const bgFetchWorker = async (startIdx: number) => {
                  for (let i = startIdx; i < remaining.length; i += 4) {
                    if (signal.aborted) return;
                    const chunkEvents = await fetchChunk(remaining[i].url);
                    if (chunkEvents.length) {
                      pendingChunksRef.current.push(chunkEvents);
                    }
                    bgLoaded++;
                    setStreamProgress({ loaded: bgLoaded, total: totalChunks });
                  }
                };

                // Fire-and-forget background download with 4 workers
                Promise.all(
                  Array.from({ length: Math.min(4, remaining.length) }, (_, i) => bgFetchWorker(i))
                ).then(() => {
                  if (signal.aborted) return;
                  // Final flush: append any remaining pending chunks
                  if (pendingChunksRef.current.length > 0) {
                    const newEvents = pendingChunksRef.current.flat();
                    pendingChunksRef.current = [];
                    setEvents(prev => [...prev, ...newEvents]);
                  }
                });

                // Periodically append pending chunks to the player (every 2s)
                appendIntervalRef.current = setInterval(() => {
                  if (pendingChunksRef.current.length > 0) {
                    const newEvents = pendingChunksRef.current.flat();
                    pendingChunksRef.current = [];
                    setEvents(prev => [...prev, ...newEvents]);
                  }
                }, 2000);
              }

              setStreamProgress({ loaded: sorted.length <= initialCount ? totalChunks : initialCount, total: totalChunks });
              return; // Player will init via the events useEffect
            }

            // No full snapshot in first 3 — load all remaining
            for (let i = initialCount; i < sorted.length; i++) {
              if (signal.aborted) return;
              const chunkEvents = await fetchChunk(sorted[i].url);
              if (chunkEvents.length) initialEvents.push(...chunkEvents);
              setStreamProgress({ loaded: i + 1, total: totalChunks });
            }
            allEvents = initialEvents;
            if (allEvents.length > 0 && hasFullSnapshot(allEvents)) {
              setEvents(allEvents);
              setStreamProgress({ loaded: totalChunks, total: totalChunks });
              return;
            }
          }

          // ── Step 4: Try full URL as fallback ──
          if (fullURL) {
            try {
              const s3Res = await fetch(fullURL, { signal });
              if (s3Res.ok) {
                const data = await s3Res.json();
                if (Array.isArray(data) && data.length > 0) {
                  setEvents(data);
                  if (hasFullSnapshot(data)) return;
                }
              }
            } catch {}
          }
        } catch {
          // Presigned path failed — fall through to legacy API
        }

        if (signal.aborted) return;

        // ── Step 5: Legacy full-replay API endpoint ──
        const fullRes = await api.get(
          `/replays/full/${sessionId}?website_id=${websiteId}`,
          { signal, timeout: 180000 },
        );
        const payload = fullRes.data?.events ?? fullRes.data;
        const legacyEvents = Array.isArray(payload) ? payload : [];

        if (legacyEvents.length > 0) {
          setEvents(legacyEvents);
        } else if (allEvents.length > 0) {
          // Use whatever we got from chunks even without FullSnapshot
          setEvents(allEvents);
        }
      } catch (err: any) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError' || err?.name === 'CanceledError') return;
        setError((err as any).message || 'Failed to load replay');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    load();
    return () => {
      controller.abort();
      if (appendIntervalRef.current) {
        clearInterval(appendIntervalRef.current);
        appendIntervalRef.current = null;
      }
    };
  }, [sessionId, websiteId]);

  // Track how many events we've fed to the player so we only addEvent() new ones
  const playerEventCountRef = useRef(0);
  const playerInitializedRef = useRef(false);

  // ─── Player initialisation (runs once when first events arrive) ───────────
  useEffect(() => {
    if (loading || events.length < 2 || !playerRef.current) return;
    if (!events.some((e: any) => e.type === 2)) return;
    // Don't re-init if player already exists (progressive loading appends via separate effect)
    if (playerInstanceRef.current && playerInitializedRef.current) return;

    playerRef.current.innerHTML = '';

    const containerW = videoAreaRef.current?.offsetWidth || playerRef.current.offsetWidth || 960;
    const containerH = videoAreaRef.current?.offsetHeight || 600;
    const sortedEvents = [...events].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    let player: rrwebPlayer;
    try {
      player = new rrwebPlayer({
        target: playerRef.current,
        props: {
          events: sortedEvents,
          autoPlay: true,
          speed: 1,
          width: containerW,
          height: containerH,
          showController: false,
          skipInactive: true,
          UNSAFE_replayCanvas: true,
        },
      });
    } catch (err) {
      console.warn('[ReplayPlayer] Failed to init:', err);
      setError('Failed to initialise replay player. The session data may be corrupted.');
      return;
    }

    playerInstanceRef.current = player;
    playerInitializedRef.current = true;
    playerEventCountRef.current = events.length;
    finishedRef.current = false;
    setIsPlaying(true);
    isPlayingRef.current = true;
    setSpeed(1);
    speedRef.current = 1;
    setSkipInactive(true);

    // Get duration
    try {
      const meta = player.getMetaData();
      const metaDuration = (session?.duration_seconds ?? 0) * 1000;
      const rrwebDuration = meta.totalTime > 0 ? meta.totalTime : 0;
      const resolved = Math.max(metaDuration, rrwebDuration) || rrwebDuration || metaDuration;
      if (resolved > 0) setTotalTime(resolved);
    } catch {}

    // Simple time tracker — poll rrweb's internal timer every 100ms
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!playerInstanceRef.current || finishedRef.current) return;
      try {
        const replayer = playerInstanceRef.current.getReplayer?.();
        if (replayer) {
          const t = replayer.getCurrentTime?.() ?? 0;
          if (typeof t === 'number' && t >= 0) {
            setCurrentTime(t);
          }
        }
      } catch {}
    }, 100);

    // Listen for state changes and finish
    try {
      const replayer = player.getReplayer();
      if (replayer) {
        replayer.on('state-change', (states: any) => {
          const playerState = states?.player?.value;
          if (playerState) {
            const playing = playerState === 'playing';
            isPlayingRef.current = playing;
            setIsPlaying(playing);
          }
        });
        replayer.on('finish', () => {
          isPlayingRef.current = false;
          finishedRef.current = true;
          setIsPlaying(false);
        });
      }
    } catch {}

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      try { (player as any).$destroy(); } catch {}
      playerInstanceRef.current = null;
      playerInitializedRef.current = false;
      playerEventCountRef.current = 0;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, events.length < 2, session?.duration_seconds]);

  // ─── Append new events from background chunk loading ──────────────────────
  useEffect(() => {
    if (!playerInitializedRef.current || !playerInstanceRef.current) return;
    if (events.length <= playerEventCountRef.current) return;

    const replayer = playerInstanceRef.current.getReplayer?.();
    if (!replayer) return;

    // Add only the new events that haven't been fed to the player yet
    const newEvents = events.slice(playerEventCountRef.current);
    for (const event of newEvents) {
      try {
        replayer.addEvent(event);
      } catch {}
    }
    playerEventCountRef.current = events.length;

    // Update duration with new events
    try {
      const meta = playerInstanceRef.current.getMetaData();
      if (meta.totalTime > 0) setTotalTime(prev => Math.max(prev, meta.totalTime));
    } catch {}
  }, [events]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const player = playerInstanceRef.current;
      if (!player || !videoAreaRef.current) return;
      const w = videoAreaRef.current.offsetWidth;
      if (w > 0) {
        try { (player as any).$set({ width: w }); } catch {}
      }
    };
    window.addEventListener('resize', handleResize);
    const t = setTimeout(handleResize, 200);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(t); };
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Controls ──────────────────────────────────────────────────────────────
  const safeGoto = useCallback((timeMs: number, play: boolean) => {
    const player = playerInstanceRef.current;
    if (!player) return;
    // Use rrweb metadata as fallback when totalTime state hasn't resolved yet
    let maxTime = totalTime;
    if (maxTime <= 0) {
      try { maxTime = player.getMetaData().totalTime || 0; } catch {}
    }
    const clamped = Math.max(0, maxTime > 0 ? Math.min(timeMs, maxTime) : timeMs);
    try {
      // Always use player.goto() — it properly syncs rrweb-player state machine
      // Calling replayer.play() directly causes state desync and breaks seeking
      player.goto(clamped, play);
      setCurrentTime(clamped);
      finishedRef.current = false;
    } catch (err) {
      console.warn('[ReplayPlayer] goto failed:', err);
    }
  }, [totalTime]);

  const handleTogglePlay = useCallback(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    if (isPlayingRef.current) {
      try { player.pause(); } catch {}
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      if (finishedRef.current) {
        finishedRef.current = false;
        safeGoto(0, true);
      } else {
        try { player.play(); } catch {}
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, [safeGoto]);

  const handleSetSpeed = useCallback((newSpeed: number) => {
    const player = playerInstanceRef.current;
    if (!player) return;
    try {
      // rrweb-player Svelte component uses $set for props
      (player as any).$set({ speed: newSpeed });
    } catch {
      try { player.setSpeed?.(newSpeed); } catch {}
    }
    // Also set on replayer directly as a fallback
    try {
      const replayer = player.getReplayer?.();
      if (replayer) (replayer as any).setConfig?.({ speed: newSpeed });
    } catch {}
    speedRef.current = newSpeed;
    setSpeed(newSpeed);
  }, []);

  const handleSkipForward = useCallback(() => {
    if (!playerInstanceRef.current) return;
    safeGoto(currentTime + 10000, isPlayingRef.current);
  }, [currentTime, safeGoto]);

  const handleSkipBack = useCallback(() => {
    if (!playerInstanceRef.current) return;
    safeGoto(Math.max(currentTime - 10000, 0), isPlayingRef.current);
  }, [currentTime, safeGoto]);

  const handleToggleSkipInactive = useCallback(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    const next = !skipInactive;
    try {
      (player as any).$set({ skipInactive: next });
    } catch {
      try { player.toggleSkipInactive?.(); } catch {}
    }
    setSkipInactive(next);
  }, [skipInactive]);

  const seekTo = useCallback((clientX: number) => {
    const track = scrubberRef.current;
    if (!playerInstanceRef.current || !track || totalTime === 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = Math.floor(ratio * totalTime);
    finishedRef.current = false;
    safeGoto(newTime, isPlayingRef.current);
  }, [totalTime, safeGoto]);

  const handleScrubberPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
  }, [seekTo]);

  const handleScrubberPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    seekTo(e.clientX);
  }, [seekTo]);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  const progress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-muted/20 rounded-xl border border-border/60">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40 mb-3" />
        <span className="text-sm font-medium text-muted-foreground">Loading session...</span>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {streamProgress.total > 0
            ? `Loading chunk ${streamProgress.loaded} of ${streamProgress.total}...`
            : 'Fetching replay data...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl max-w-2xl mx-auto">
        <h3 className="text-base font-semibold text-rose-700 dark:text-rose-400 mb-2">Playback Error</h3>
        <p className="text-sm text-rose-600/80 dark:text-rose-400/60 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} size="sm" variant="outline" className="gap-2 text-xs border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  // ─── Player ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-4">
      <style>{`
        .rr-player {
          border: none !important;
          background: #09090b !important;
          border-radius: 0 !important;
          height: 100% !important;
        }
        .rr-player__frame {
          border-radius: 0 !important;
          flex: 1 !important;
        }
        .rr-controller {
          display: none !important;
        }
      `}</style>

      <Card ref={containerRef} className="border border-border bg-card overflow-hidden shadow-sm">
        <div ref={videoAreaRef} className="bg-zinc-950 relative" style={{ height: '600px' }}>
          {events.length < 2 ? (
            <div className="flex items-center justify-center h-full p-12 text-center">
              <div>
                {isDemo(websiteId) ? (
                  <>
                    <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <Play className="h-6 w-6 text-white/20" />
                    </div>
                    <p className="text-sm font-medium text-white/40 mb-1.5">Session Replay Preview</p>
                    <p className="text-xs text-white/20 max-w-xs">Replays capture every click, scroll, and page interaction. Sign up to start recording real sessions.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white/30 mb-1">No events recorded</p>
                    <p className="text-xs text-white/15">This session contains no replay data.</p>
                  </>
                )}
              </div>
            </div>
          ) : !events.some((e: any) => e.type === 2) ? (
            <div className="flex items-center justify-center h-full p-12 text-center">
              <div>
                <p className="text-sm font-medium text-white/30 mb-1">No page snapshot available</p>
                <p className="text-xs text-white/15">This session is missing the initial DOM snapshot required for visual playback.</p>
              </div>
            </div>
          ) : (
            <div ref={playerRef} className="w-full h-full" />
          )}
        </div>

        {events.length > 0 && (
          <div className="bg-zinc-950/95 backdrop-blur-sm border-t border-white/[0.06] px-4 py-3 space-y-2.5">
            {/* Timeline scrubber */}
            <div
              ref={scrubberRef}
              className="group relative h-1.5 bg-white/[0.08] rounded-full cursor-pointer hover:h-2.5 transition-all select-none"
              style={{ touchAction: 'none' }}
              onPointerDown={handleScrubberPointerDown}
              onPointerMove={handleScrubberPointerMove}
            >
              <div
                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                style={{ left: `${progress}%` }}
              />
            </div>
            {/* Controls row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSkipBack}
                  className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                  title="Back 10s"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.12] transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={handleSkipForward}
                  className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                  title="Forward 10s"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>

                <span className="text-[11px] font-mono text-white/40 ml-2 tabular-nums select-none">
                  {formatTime(currentTime)} / {formatTime(totalTime)}
                </span>
                {streamProgress.total > 0 && streamProgress.loaded < streamProgress.total && (
                  <span className="text-[10px] text-blue-400/60 ml-2 flex items-center gap-1">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    {streamProgress.loaded}/{streamProgress.total}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSetSpeed(s)}
                      className={cn(
                        "h-6 px-2 rounded-md text-[11px] font-medium transition-all",
                        speed === s
                          ? "bg-blue-500 text-white shadow-sm"
                          : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <div className="h-4 w-px bg-white/[0.08]" />

                <button
                  onClick={handleToggleSkipInactive}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all",
                    skipInactive
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
                  )}
                  title="Skip inactive periods"
                >
                  <FastForward className="h-3 w-3" />
                  Skip
                </button>

                <div className="h-4 w-px bg-white/[0.08]" />

                <button
                  onClick={handleToggleFullscreen}
                  className="h-8 w-8 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
