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
  const isPlayingRef = useRef(false);
  const finishedRef = useRef(false);
  const currentTimeRef = useRef(0);
  const totalTimeRef = useRef(0);
  const videoAreaRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [streamProgress, setStreamProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
  const pendingEventsRef = useRef<any[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(
    () => (session?.duration_seconds ?? 0) * 1000
  );
  const [speed, setSpeed] = useState(1);
  const [skipInactive, setSkipInactive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerInitKey, setPlayerInitKey] = useState(0); // bump to force player re-init
  const pendingSeekRef = useRef<number | null>(null);    // seek position after re-init
  const reinitCountRef = useRef(0);                      // guard against infinite re-init loops

  // Smooth timer refs — interpolate between event-cast ticks
  const speedRef = useRef(1);
  const lastEventTimeRef    = useRef(0);   // replay-relative ms at last event-cast
  const lastWallTimeRef     = useRef(0);   // Date.now() when last event-cast fired
  const lastEventCastWallRef = useRef(0);  // wall time of last event-cast (watchdog)
  const smoothTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastWatchdogPosRef  = useRef(0);   // position where watchdog last fired
  const watchdogRetryRef    = useRef(0);   // consecutive stalls at same position

  useEffect(() => { totalTimeRef.current = totalTime; }, [totalTime]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // ─── Data loading (progressive streaming) ──────────────────────────────────
  // Strategy:
  //  1. Fetch presigned manifest → get per-chunk presigned S3 URLs.
  //  2. Download chunk 0 (full DOM snapshot) → start playback immediately.
  //  3. Download remaining chunks in background (3 concurrent) → inject events
  //     into the running player via replayer.addEvent().
  //  4. Fallback: if manifest has a full_url and only 1-3 chunks, use the
  //     stitched file instead (faster for short sessions).
  //  5. Final fallback: legacy /replays/full/:id API endpoint.
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    pendingEventsRef.current = [];

    const fetchChunk = async (url: string): Promise<any[]> => {
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    };

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setEvents([]);
        setStreamProgress({ loaded: 0, total: 0 });

        // ── Attempt 1: progressive chunk streaming via presigned manifest ──
        try {
          const manifestRes = await api.get(
            `/replays/presigned-manifest/${sessionId}?website_id=${websiteId}`,
            { signal, timeout: 20000 },
          );

          const manifest = manifestRes.data;
          const chunks: { seq: number; url: string }[] = manifest?.chunks ?? [];
          const totalChunks: number = manifest?.total_chunks ?? chunks.length;
          const fullURL: string | undefined = manifest?.full_url;

          if (signal.aborted) return;

          // For very short sessions (≤3 chunks) with a stitched cache, use the
          // single full download — it's faster than 3 separate requests.
          if (fullURL && totalChunks <= 3) {
            const s3Res = await fetch(fullURL, { signal });
            if (s3Res.ok) {
              const data = await s3Res.json();
              if (Array.isArray(data) && data.length > 0) {
                setEvents(data);
                setStreamProgress({ loaded: totalChunks, total: totalChunks });
                return;
              }
            }
          }

          // Progressive streaming: load chunk 0 first, start playback, then
          // fetch remaining chunks concurrently in the background.
          if (chunks.length > 0) {
            setStreamProgress({ loaded: 0, total: totalChunks });

            // Sort by seq to ensure chunk 0 is first
            const sorted = [...chunks].sort((a, b) => a.seq - b.seq);

            // Fetch chunk 0 — the full DOM snapshot required to start rrweb
            const firstEvents = await fetchChunk(sorted[0].url);
            if (signal.aborted) return;

            if (firstEvents.length > 0) {
              setEvents(firstEvents);
              setStreamProgress({ loaded: 1, total: totalChunks });

              // Fetch remaining chunks in background with bounded concurrency
              if (sorted.length > 1) {
                const remaining = sorted.slice(1);
                let loadedCount = 1;
                const concurrency = 3;

                const fetchNext = async (idx: number) => {
                  while (idx < remaining.length) {
                    if (signal.aborted) return;
                    const chunkEvents = await fetchChunk(remaining[idx].url);
                    if (signal.aborted) return;
                    if (chunkEvents.length > 0) {
                      // Sort by timestamp before injecting
                      chunkEvents.sort((a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
                      pendingEventsRef.current.push(...chunkEvents);

                      // Inject into running player if available
                      const replayer = playerInstanceRef.current?.getReplayer?.();
                      if (replayer) {
                        for (const ev of chunkEvents) {
                          try { replayer.addEvent(ev); } catch {}
                        }
                      } else {
                        // Player not ready yet — merge into events state
                        setEvents(prev => [...prev, ...chunkEvents]);
                      }
                    }
                    loadedCount++;
                    setStreamProgress({ loaded: loadedCount, total: totalChunks });
                    idx += concurrency;
                  }
                };

                // Launch concurrent fetchers
                const workers = [];
                for (let w = 0; w < Math.min(concurrency, remaining.length); w++) {
                  workers.push(fetchNext(w));
                }
                // Don't await — let them run in background while playback starts
                Promise.all(workers).catch(() => {});
              }

              return; // Playback started with chunk 0
            }
          }

          // Chunks approach failed — try full URL if available
          if (fullURL) {
            const s3Res = await fetch(fullURL, { signal });
            if (s3Res.ok) {
              const data = await s3Res.json();
              if (Array.isArray(data)) {
                setEvents(data);
                return;
              }
            }
          }
        } catch {
          // Presigned path failed — fall through to legacy API
        }

        if (signal.aborted) return;

        // ── Attempt 2: legacy full-replay API endpoint ────────────────────
        const fullRes = await api.get(
          `/replays/full/${sessionId}?website_id=${websiteId}`,
          { signal, timeout: 180000 },
        );
        const payload = fullRes.data?.events ?? fullRes.data;
        setEvents(Array.isArray(payload) ? payload : []);
      } catch (err: any) {
        if (
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'AbortError' ||
          err?.name === 'CanceledError'
        ) return;
        setError((err as any).message || 'Failed to load replay');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [sessionId, websiteId]);

  // ─── Smooth timer helpers ──────────────────────────────────────────────────
  const startSmoothTimer = useCallback(() => {
    if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
    smoothTimerRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;
      const elapsed = (Date.now() - lastWallTimeRef.current) * speedRef.current;
      const interpolated = Math.min(lastEventTimeRef.current + elapsed, totalTimeRef.current);
      currentTimeRef.current = interpolated;
      setCurrentTime(interpolated);
    }, 50);
  }, []);

  const stopSmoothTimer = useCallback(() => {
    if (smoothTimerRef.current) { clearInterval(smoothTimerRef.current); smoothTimerRef.current = null; }
  }, []);

  // ─── Player initialisation ─────────────────────────────────────────────────
  useEffect(() => {
    // rrweb requires at least 2 events to initialise the replayer.
    // Additionally, a FullSnapshot event (type 2) is mandatory — without it the
    // player iframe renders nothing (progress bar moves but no visual content).
    if (loading || events.length < 2 || !playerRef.current) return;

    const hasSnapshot = events.some((e: any) => e.type === 2);
    if (!hasSnapshot) {
      // No DOM snapshot yet — wait for more chunks to arrive
      console.warn('[ReplayPlayer] No FullSnapshot (type 2) event found in', events.length, 'events — waiting for more data');
      return;
    }

    playerRef.current.innerHTML = '';
    stopSmoothTimer();

    // Read the actual rendered container width. If it's 0 the DOM hasn't
    // finished layout yet — clamp to a safe desktop default (960px) rather
    // than using window.innerWidth which can exceed the card's actual width
    // and cause the right side to be clipped.
    const containerW = videoAreaRef.current?.offsetWidth || playerRef.current.offsetWidth || 960;
    const containerH = videoAreaRef.current?.offsetHeight || 600;

    // Sort events by timestamp — out-of-order events cause "Node not found" warnings
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
          skipInactive: false,
          UNSAFE_replayCanvas: true,
        },
      });
    } catch (err) {
      console.warn('[ReplayPlayer] Failed to initialise rrweb player:', err);
      setError('Failed to initialise replay player. The session data may be corrupted.');
      return;
    }

    playerInstanceRef.current = player;
    finishedRef.current = false;
    currentTimeRef.current = 0;
    lastEventTimeRef.current = 0;
    lastWallTimeRef.current = Date.now();
    lastEventCastWallRef.current = Date.now();

    try {
      const meta = player.getMetaData();
      const metaDuration = (session?.duration_seconds ?? 0) * 1000;
      const rrwebDuration = meta.totalTime > 0 ? meta.totalTime : 0;
      const resolved = Math.max(metaDuration, rrwebDuration) || rrwebDuration || metaDuration;
      if (resolved > 0) setTotalTime(resolved);
    } catch {}

    setIsPlaying(true);
    isPlayingRef.current = true;
    setSpeed(1);
    speedRef.current = 1;
    setSkipInactive(false);
    startSmoothTimer();

    // If we're re-initing after a goto failure, seek to the pending position.
    // Use replayer.play(offset) which is more resilient than player.goto().
    // If it still fails, give up and play from the beginning.
    if (pendingSeekRef.current !== null) {
      const seekTarget = pendingSeekRef.current;
      pendingSeekRef.current = null;
      reinitCountRef.current++;

      // After 2 failed re-inits, stop trying to seek — just play from start
      if (reinitCountRef.current <= 2) {
        try {
          const replayer = player.getReplayer();
          if (replayer) {
            replayer.play(seekTarget);
          } else {
            player.goto(seekTarget, true);
          }
          currentTimeRef.current = seekTarget;
          lastEventTimeRef.current = seekTarget;
          lastWallTimeRef.current = Date.now();
          setCurrentTime(seekTarget);
        } catch {
          // Seek failed on fresh player — just play from start
          console.warn('[ReplayPlayer] Seek after re-init failed, playing from start');
        }
      } else {
        // Too many re-inits — reset counter, play from start
        reinitCountRef.current = 0;
      }
    } else {
      reinitCountRef.current = 0;
    }

    let sessionStartTime = 0;
    try { sessionStartTime = player.getMetaData().startTime ?? 0; } catch {}

    try {
      const replayer = player.getReplayer();
      if (replayer) {
        replayer.on('event-cast', (event: any) => {
          lastEventCastWallRef.current = Date.now();
          if (typeof event?.timestamp === 'number' && sessionStartTime > 0) {
            const rel = event.timestamp - sessionStartTime;
            if (rel >= 0) {
              // Sync smooth timer anchor to exact event timestamp
              lastEventTimeRef.current = rel;
              lastWallTimeRef.current  = Date.now();
              currentTimeRef.current   = rel;
              setCurrentTime(rel);
            }
          }
        });
        replayer.on('state-change', (states: any) => {
          const playerState = states?.player?.value;
          if (playerState) {
            const playing = playerState === 'playing';
            isPlayingRef.current = playing;
            setIsPlaying(playing);
            if (playing) {
              lastWallTimeRef.current = Date.now();
              startSmoothTimer();
            } else {
              stopSmoothTimer();
            }
          }
        });
        replayer.on('finish', () => {
          isPlayingRef.current = false;
          finishedRef.current = true;
          setIsPlaying(false);
          stopSmoothTimer();
          if (watchdogTimerRef.current) { clearInterval(watchdogTimerRef.current); watchdogTimerRef.current = null; }
        });
      }
    } catch {}

    // Reset watchdog retry counters on new player init
    lastWatchdogPosRef.current = 0;
    watchdogRetryRef.current = 0;

    // Watchdog: if no event-cast fires for >2s while "playing", seek forward to unstick.
    // Uses escalating jumps (10s → 30s → 60s) when stuck at the same position.
    watchdogTimerRef.current = setInterval(() => {
      if (!isPlayingRef.current || finishedRef.current || !playerInstanceRef.current) return;
      const stale = Date.now() - lastEventCastWallRef.current;
      if (stale > 2000) {
        const pos = currentTimeRef.current;
        const samePos = Math.abs(pos - lastWatchdogPosRef.current) < 500;
        if (samePos) {
          watchdogRetryRef.current++;
        } else {
          watchdogRetryRef.current = 0;
          lastWatchdogPosRef.current = pos;
        }
        // After 5 consecutive stalls at the same position, give up and finish
        if (watchdogRetryRef.current >= 5) {
          finishedRef.current = true;
          isPlayingRef.current = false;
          setIsPlaying(false);
          stopSmoothTimer();
          return;
        }
        // Escalate jump size on repeated stalls at the same position
        const maxJump = watchdogRetryRef.current >= 2 ? 60000 : watchdogRetryRef.current >= 1 ? 30000 : 10000;
        const jumpAmount = Math.min(Math.max(stale * speedRef.current, 5000), maxJump);
        const nudge = Math.min(pos + jumpAmount, totalTimeRef.current - 100);
        if (nudge > pos + 100) {
          try {
            playerInstanceRef.current.goto(nudge, true);
            lastEventCastWallRef.current = Date.now();
            lastWallTimeRef.current = Date.now();
            lastWatchdogPosRef.current = nudge;
            currentTimeRef.current = nudge;
          } catch {
            // goto corrupted player — just force finish, don't loop re-inits
            finishedRef.current = true;
            isPlayingRef.current = false;
            setIsPlaying(false);
            stopSmoothTimer();
            if (watchdogTimerRef.current) { clearInterval(watchdogTimerRef.current); watchdogTimerRef.current = null; }
          }
        } else {
          // At the very end — force finish
          finishedRef.current = true;
          isPlayingRef.current = false;
          setIsPlaying(false);
          stopSmoothTimer();
        }
      }
    }, 2000);

    return () => {
      stopSmoothTimer();
      if (watchdogTimerRef.current) { clearInterval(watchdogTimerRef.current); watchdogTimerRef.current = null; }
      try { (player as any).$destroy(); } catch {}
      playerInstanceRef.current = null;
    };
  }, [loading, events, playerInitKey, startSmoothTimer, stopSmoothTimer]);

  // Resize player when container width changes
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
    // Also run once shortly after mount in case layout wasn't ready
    const t = setTimeout(handleResize, 200);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(t); };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ─── Safe goto wrapper ─────────────────────────────────────────────────────
  // player.goto() can throw when seeking past available events or into
  // unloaded chunks, corrupting rrweb's internal DOM state. When that
  // happens we destroy the player and re-init from scratch. After 2
  // consecutive failures we give up seeking and just play from start.
  const safeGoto = useCallback((timeMs: number, play: boolean) => {
    const player = playerInstanceRef.current;
    if (!player) return false;
    const clamped = Math.max(0, Math.min(timeMs, totalTimeRef.current));
    try {
      // Try replayer.play(offset) first — it's more resilient than goto()
      // because it processes events through the state machine rather than
      // synchronous DOM rebuild.
      const replayer = player.getReplayer?.();
      if (replayer && play) {
        replayer.play(clamped);
      } else {
        player.goto(clamped, play);
      }
      reinitCountRef.current = 0;
      lastEventTimeRef.current = clamped;
      lastWallTimeRef.current = Date.now();
      lastEventCastWallRef.current = Date.now();
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      return true;
    } catch (err) {
      console.warn('[ReplayPlayer] goto failed:', err);

      // If we've already re-inited too many times, just pause — don't loop
      if (reinitCountRef.current >= 2) {
        console.warn('[ReplayPlayer] Too many re-init attempts, staying at current position');
        reinitCountRef.current = 0;
        isPlayingRef.current = false;
        setIsPlaying(false);
        stopSmoothTimer();
        return false;
      }

      // Destroy the corrupted player and schedule a full re-init
      stopSmoothTimer();
      if (watchdogTimerRef.current) { clearInterval(watchdogTimerRef.current); watchdogTimerRef.current = null; }
      try { (player as any).$destroy(); } catch {}
      playerInstanceRef.current = null;
      if (playerRef.current) playerRef.current.innerHTML = '';
      pendingSeekRef.current = clamped;
      setPlayerInitKey(k => k + 1);
      return false;
    }
  }, [stopSmoothTimer]);

  // ─── Controls ──────────────────────────────────────────────────────────────
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
        const resumeAt = currentTimeRef.current >= totalTimeRef.current
          ? 0
          : currentTimeRef.current;
        safeGoto(resumeAt, true);
      } else {
        try {
          player.play();
        } catch {
          // play() failed (corrupted state) — re-init from current position
          safeGoto(currentTimeRef.current, true);
          return;
        }
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, [safeGoto]);

  const handleSetSpeed = useCallback((newSpeed: number) => {
    const player = playerInstanceRef.current;
    if (!player) return;
    try {
      player.setSpeed(newSpeed);
    } catch {
      (player as any).$set({ speed: newSpeed });
    }
    speedRef.current = newSpeed;
    // Re-anchor the smooth timer to now so elapsed calc uses new speed
    lastEventTimeRef.current = currentTimeRef.current;
    lastWallTimeRef.current  = Date.now();
    setSpeed(newSpeed);
  }, []);

  const handleSkipForward = useCallback(() => {
    if (!playerInstanceRef.current) return;
    const newTime = Math.min(currentTimeRef.current + 10000, totalTimeRef.current);
    finishedRef.current = false;
    safeGoto(newTime, isPlayingRef.current);
  }, [safeGoto]);

  const handleSkipBack = useCallback(() => {
    if (!playerInstanceRef.current) return;
    const newTime = Math.max(currentTimeRef.current - 10000, 0);
    finishedRef.current = false;
    safeGoto(newTime, isPlayingRef.current);
  }, [safeGoto]);

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
    const track = scrubberRef.current;
    if (!playerInstanceRef.current || !track || totalTimeRef.current === 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = Math.floor(ratio * totalTimeRef.current);
    finishedRef.current = false;
    safeGoto(newTime, isPlayingRef.current);
  }, [safeGoto]);

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
            ? `Loading chunk ${streamProgress.loaded + 1} of ${streamProgress.total}...`
            : 'Fetching first frame...'}
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
                {events.length === 0 ? (
                  <>
                    <p className="text-sm font-medium text-white/30 mb-1">No events recorded</p>
                    <p className="text-xs text-white/15">This session contains no replay data.</p>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-white/20 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white/30 mb-1">Waiting for more data...</p>
                    <p className="text-xs text-white/15">Session has too few events to replay. Loading additional chunks.</p>
                  </>
                )}
              </div>
            </div>
          ) : !events.some((e: any) => e.type === 2) ? (
            <div className="flex items-center justify-center h-full p-12 text-center">
              <div>
                {streamProgress.total > 0 && streamProgress.loaded < streamProgress.total ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-white/20 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white/30 mb-1">Loading page snapshot...</p>
                    <p className="text-xs text-white/15">Chunk {streamProgress.loaded} of {streamProgress.total} loaded. Waiting for DOM snapshot.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white/30 mb-1">No page snapshot available</p>
                    <p className="text-xs text-white/15">This session is missing the initial DOM snapshot required for visual playback.</p>
                  </>
                )}
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
