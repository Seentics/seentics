'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Monitor, Globe, Clock, Shield, Smartphone, Tablet,
  RefreshCw, Play, Pause, SkipBack, SkipForward, Maximize, Minimize,
  FastForward
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

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

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function val(v: string | undefined | null, fallback = '—'): string {
  if (!v || v === 'Unknown') return fallback;
  return v;
}

const SPEED_OPTIONS = [1, 2, 4, 8];
// Number of chunks to fetch before starting the player.
// Chunk 0 contains the full DOM snapshot so the player can render immediately.
// We pre-fetch a few more to give the player a head start before progressive
// loading kicks in.
const INITIAL_CHUNKS = 5;
// How many chunks to fetch in parallel during progressive background loading.
const BACKGROUND_BATCH = 4;
// Max retry attempts for failed chunk downloads.
const CHUNK_RETRIES = 3;

async function fetchChunk(sessionId: string, websiteId: string, seq: number, signal: AbortSignal): Promise<any[]> {
  for (let attempt = 0; attempt < CHUNK_RETRIES; attempt++) {
    try {
      const res = await api.get(
        `/replays/chunk/${sessionId}?website_id=${websiteId}&seq=${seq}`,
        { signal },
      );
      if (Array.isArray(res.data) && res.data.length > 0) return res.data;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'CanceledError') throw err;
    }
    // Wait before retrying (200ms, 600ms, 1200ms)
    if (attempt < CHUNK_RETRIES - 1) {
      await new Promise(r => setTimeout(r, 200 * (attempt + 1) * (attempt + 1)));
    }
  }
  return [];
}

export default function ReplayPlayer({ sessionId, websiteId, session }: ReplayPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<rrwebPlayer | null>(null);
  const animFrameRef = useRef<number>(0);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(false);
  const totalTimeRef = useRef(0);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  // Set to true by the player-init effect once rrwebPlayer is created.
  // Background loading must wait for this before calling player.addEvent().
  const playerReadyRef = useRef(false);
  // True when the user explicitly hit pause — prevents auto-resume on buffer refill.
  const userPausedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // initialEvents drives player creation. Once set, background loading adds
  // remaining events directly to the player via addEvent().
  const [initialEvents, setInitialEvents] = useState<any[]>([]);
  const [bufferProgress, setBufferProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [backgroundLoading, setBackgroundLoading] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Use session metadata duration as initial estimate so scrubber/progress are
  // accurate before all chunks are loaded. Refined as chunks arrive.
  const [totalTime, setTotalTime] = useState(
    () => (session?.duration_seconds ?? 0) * 1000
  );
  const [speed, setSpeed] = useState(1);
  const [skipInactive, setSkipInactive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track the highest timestamp we've loaded so far for buffer-ahead guard.
  const maxBufferedTimeRef = useRef(0);
  // Whether playback was auto-paused because it outran the buffer.
  const pausedForBufferRef = useRef(false);

  useEffect(() => { totalTimeRef.current = totalTime; }, [totalTime]);

  // ─── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    streamAbortRef.current = controller;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setInitialEvents([]);
        setBufferProgress(null);

        // Step 1: Manifest — Postgres only, no S3 round-trips
        const manifestRes = await api.get(
          `/replays/manifest/${sessionId}?website_id=${websiteId}`,
          { signal: controller.signal },
        );
        const sequences: number[] = manifestRes.data?.sequences ?? [];

        if (sequences.length === 0) {
          setInitialEvents([]);
          setLoading(false);
          return;
        }

        setBufferProgress({ loaded: 0, total: sequences.length });

        // Step 2: Fetch the first INITIAL_CHUNKS chunks before starting the player.
        // These MUST include chunk 0 (the full DOM snapshot). Without it rrweb
        // cannot render anything — incremental events reference nodes from snapshot.
        const initialSeqs = sequences.slice(0, INITIAL_CHUNKS);
        const initialResults = await Promise.all(
          initialSeqs.map(seq => fetchChunk(sessionId, websiteId, seq, controller.signal))
        );

        if (controller.signal.aborted) return;

        const initial = (initialResults.flat() as any[]).sort(
          (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
        );

        // Track the highest event timestamp we've buffered so far.
        if (initial.length > 0) {
          maxBufferedTimeRef.current = initial[initial.length - 1].timestamp ?? 0;
        }

        setBufferProgress(prev => prev ? { ...prev, loaded: initialSeqs.length } : null);
        setInitialEvents(initial);
        setLoading(false);

        // Step 3: Stream the remaining chunks in the background in small batches.
        // Each batch is added via player.addEvent() so they're available before
        // the player reaches their timestamps — avoids loading everything into
        // memory upfront for long sessions.
        const remainingSeqs = sequences.slice(INITIAL_CHUNKS);
        if (remainingSeqs.length === 0) {
          maxBufferedTimeRef.current = Infinity;
          setBufferProgress(null);
          setBackgroundLoading(false);
          return;
        }

        setBackgroundLoading(true);

        // Wait for the player-init effect to create the rrwebPlayer instance.
        // setInitialEvents/setLoading are async state updates — the player init
        // useEffect hasn't run yet when we reach this point, so playerInstanceRef
        // is still null. Calling addEvent() before it's ready silently drops events,
        // creating gaps that cause playback to freeze.
        {
          let waited = 0;
          while (!playerReadyRef.current && !controller.signal.aborted) {
            await new Promise(r => setTimeout(r, 30));
            if ((waited += 30) > 5000) break; // 5s safety timeout
          }
        }

        for (let i = 0; i < remainingSeqs.length; i += BACKGROUND_BATCH) {
          if (controller.signal.aborted) break;

          const batch = remainingSeqs.slice(i, i + BACKGROUND_BATCH);
          const results = await Promise.all(
            batch.map(seq => fetchChunk(sessionId, websiteId, seq, controller.signal))
          );

          if (controller.signal.aborted) break;

          // Sort within batch before adding so rrweb always gets monotonic timestamps.
          const events = (results.flat() as any[]).sort(
            (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
          );

          // Track the highest buffered timestamp so the buffer-ahead guard
          // knows how far ahead we've loaded.
          if (events.length > 0) {
            const lastTs = events[events.length - 1].timestamp ?? 0;
            if (lastTs > maxBufferedTimeRef.current) maxBufferedTimeRef.current = lastTs;
          }

          // Add events to the running player.
          const player = playerInstanceRef.current;
          if (player) {
            events.forEach(e => player.addEvent(e));
            // Extend totalTime as more events are added.
            try {
              const newMeta = player.getMetaData();
              if (newMeta.totalTime > 0) setTotalTime(newMeta.totalTime);
            } catch {}

            // If we previously auto-paused because the buffer ran out,
            // resume now that more data is available.
            if (pausedForBufferRef.current) {
              pausedForBufferRef.current = false;
              player.play();
              isPlayingRef.current = true;
              setIsPlaying(true);
            }
          }

          setBufferProgress(prev =>
            prev ? { ...prev, loaded: Math.min(prev.loaded + batch.length, prev.total) } : null
          );
        }

        // All chunks loaded — disable buffer-ahead guard entirely.
        maxBufferedTimeRef.current = Infinity;
        streamAbortRef.current = null; // signals guard: no more streaming
        if (pausedForBufferRef.current) {
          pausedForBufferRef.current = false;
          const player = playerInstanceRef.current;
          if (player) {
            player.play();
            isPlayingRef.current = true;
            setIsPlaying(true);
          }
        }
        setBufferProgress(null);
        setBackgroundLoading(false);
      } catch (err: any) {
        if (
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'AbortError' ||
          err?.name === 'CanceledError'
        ) return;
        setError(err.message || 'Failed to fetch replay data');
        setLoading(false);
      }
    };

    load();

    return () => {
      controller.abort();
      streamAbortRef.current = null;
    };
  }, [sessionId, websiteId]);

  // ─── Player initialisation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && initialEvents.length > 0 && playerRef.current) {
      playerRef.current.innerHTML = '';

      const containerW = videoAreaRef.current?.offsetWidth || playerRef.current.offsetWidth || 1024;
      const containerH = videoAreaRef.current?.offsetHeight || 600;

      const player = new rrwebPlayer({
        target: playerRef.current,
        props: {
          events: initialEvents,
          autoPlay: true,
          speed: 1,
          width: containerW,
          height: containerH,
          showController: false,
          skipInactive: false,
          UNSAFE_replayCanvas: true,
        },
      });

      playerInstanceRef.current = player;
      playerReadyRef.current = true;
      userPausedRef.current = false;

      let sessionStartTime = 0;
      try {
        const meta = player.getMetaData();
        sessionStartTime = meta.startTime ?? 0;
        // Only use rrweb's totalTime if it's larger than the metadata estimate.
        // With partial chunks loaded, rrweb's value is too short; the session
        // metadata duration (from DB) is more accurate until all chunks arrive.
        const metaDuration = (session?.duration_seconds ?? 0) * 1000;
        const rrwebDuration = meta.totalTime > 0 ? meta.totalTime : 0;
        if (rrwebDuration > metaDuration) {
          setTotalTime(rrwebDuration);
        } else if (metaDuration > 0) {
          setTotalTime(metaDuration);
        } else if (rrwebDuration > 0) {
          setTotalTime(rrwebDuration);
        }
      } catch {}

      setIsPlaying(true);
      isPlayingRef.current = true;
      setSpeed(1);
      setSkipInactive(false);

      try {
        const replayer = player.getReplayer();
        if (replayer) {
          // 'event-cast' fires for every rrweb event as it's replayed.
          // event.timestamp is the absolute ms epoch; subtract sessionStartTime
          // to get the relative playback position (0-based ms from session start).
          replayer.on('event-cast', (event: any) => {
            if (typeof event?.timestamp === 'number' && sessionStartTime > 0) {
              const rel = event.timestamp - sessionStartTime;
              if (rel >= 0) setCurrentTime(rel);

              // Buffer-ahead guard: if playback is within 2s of the last
              // buffered event and we're still loading, pause to avoid
              // the player hitting a gap and getting stuck.
              const maxBuf = maxBufferedTimeRef.current;
              if (
                maxBuf > 0 &&
                !pausedForBufferRef.current &&
                isPlayingRef.current &&
                event.timestamp > maxBuf - 2000 &&
                streamAbortRef.current // still loading
              ) {
                pausedForBufferRef.current = true;
                player.pause();
                isPlayingRef.current = false;
                setIsPlaying(false);
              }
            }
          });
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
            setIsPlaying(false);
            // If we're still streaming more chunks, the player hit the end of
            // what's been loaded so far — treat it as a buffer stall so the
            // background loader will resume playback when the next batch arrives.
            if (streamAbortRef.current && !userPausedRef.current) {
              pausedForBufferRef.current = true;
            }
          });
        }
      } catch {}

      return () => {
        cancelAnimationFrame(animFrameRef.current);
        try { (player as any).$destroy(); } catch {}
        playerInstanceRef.current = null;
        playerReadyRef.current = false;
      };
    }
  }, [loading, initialEvents]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ─── Controls ──────────────────────────────────────────────────────────────
  const handleTogglePlay = useCallback(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    if (isPlayingRef.current) {
      userPausedRef.current = true;
      player.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      userPausedRef.current = false;
      player.play();
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, []);

  const handleSetSpeed = useCallback((newSpeed: number) => {
    const player = playerInstanceRef.current;
    if (!player) return;
    try {
      player.setSpeed(newSpeed);
    } catch {
      (player as any).$set({ speed: newSpeed });
    }
    setSpeed(newSpeed);
  }, []);

  const handleSkipForward = useCallback(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    const newTime = Math.min(currentTime + 10000, totalTimeRef.current);
    player.goto(newTime, isPlayingRef.current);
    setCurrentTime(newTime);
  }, [currentTime]);

  const handleSkipBack = useCallback(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    const newTime = Math.max(currentTime - 10000, 0);
    player.goto(newTime, isPlayingRef.current);
    setCurrentTime(newTime);
  }, [currentTime]);

  const handleToggleSkipInactive = useCallback(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    const next = !skipInactive;
    try {
      player.toggleSkipInactive();
    } catch {
      (player as any).$set({ skipInactive: next });
    }
    setSkipInactive(next);
  }, [skipInactive]);

  const seekTo = useCallback((clientX: number) => {
    const player = playerInstanceRef.current;
    const track = scrubberRef.current;
    if (!player || !track || totalTimeRef.current === 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = Math.floor(ratio * totalTimeRef.current);
    player.goto(newTime, isPlayingRef.current);
    setCurrentTime(newTime);
  }, []);

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

  const getDeviceIcon = () => {
    if (!session?.device) return Monitor;
    const d = session.device.toLowerCase();
    if (d.includes('mobile') || d.includes('phone')) return Smartphone;
    if (d.includes('tablet') || d.includes('ipad')) return Tablet;
    return Monitor;
  };

  const DeviceIcon = getDeviceIcon();
  const progress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-muted/20 rounded-xl border border-border/60">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40 mb-3" />
        <span className="text-sm font-medium text-muted-foreground">Loading session...</span>
        {bufferProgress ? (
          <>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Fetching chunks — {bufferProgress.loaded} / {bufferProgress.total}
            </p>
            <div className="mt-3 w-40 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-200"
                style={{ width: `${(bufferProgress.loaded / bufferProgress.total) * 100}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-1">Fetching session data...</p>
        )}
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
          {initialEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full p-12 text-center">
              <div>
                <p className="text-sm font-medium text-white/30 mb-1">No events recorded</p>
                <p className="text-xs text-white/15">This session contains no replay data.</p>
              </div>
            </div>
          ) : (
            <div ref={playerRef} className="w-full h-full" />
          )}

          {/* Background loading indicator — shown while remaining chunks stream in */}
          {backgroundLoading && bufferProgress && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-white/50" />
              <span className="text-[10px] text-white/50 tabular-nums">
                {bufferProgress.loaded}/{bufferProgress.total}
              </span>
            </div>
          )}
        </div>

        {initialEvents.length > 0 && (
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

      {session && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetaCard icon={DeviceIcon} label="Device" value={`${val(session.browser)} · ${val(session.device, 'Desktop')}`} />
          <MetaCard icon={Globe} label="Location" value={val(session.country)} />
          <MetaCard icon={Clock} label="Duration" value={session.duration_seconds ? formatDuration(session.duration_seconds) : '—'} />
          <MetaCard icon={Shield} label="Privacy" value="PII masked at edge" subtle />
        </div>
      )}
    </div>
  );
}

function MetaCard({ icon: Icon, label, value, subtle }: { icon: any; label: string; value: string; subtle?: boolean }) {
  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-start gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={cn("text-sm font-medium mt-0.5 truncate", subtle && "text-muted-foreground")}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
