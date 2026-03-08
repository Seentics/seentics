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

export default function ReplayPlayer({ sessionId, websiteId, session }: ReplayPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<rrwebPlayer | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(false);
  const finishedRef = useRef(false);   // true when replay reached the end
  const currentTimeRef = useRef(0);    // mirror of currentTime for callbacks
  const totalTimeRef = useRef(0);
  const videoAreaRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(
    () => (session?.duration_seconds ?? 0) * 1000
  );
  const [speed, setSpeed] = useState(1);
  const [skipInactive, setSkipInactive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => { totalTimeRef.current = totalTime; }, [totalTime]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // ─── Data loading ──────────────────────────────────────────────────────────
  // Fetch all events in one request. The server stitches all S3 chunks,
  // sorts by timestamp, and returns a single flat JSON array.
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setEvents([]);
        const res = await api.get(
          `/replays/full/${sessionId}?website_id=${websiteId}`,
          { signal: controller.signal },
        );
        setEvents(res.data?.events ?? []);
      } catch (err: any) {
        if (
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'AbortError' ||
          err?.name === 'CanceledError'
        ) return;
        setError(err.message || 'Failed to fetch replay data');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [sessionId, websiteId]);

  // ─── Player initialisation ─────────────────────────────────────────────────
  // All events are available upfront — create the player once, no streaming needed.
  useEffect(() => {
    if (loading || events.length === 0 || !playerRef.current) return;

    playerRef.current.innerHTML = '';

    const containerW = videoAreaRef.current?.offsetWidth || playerRef.current.offsetWidth || 1024;
    const containerH = videoAreaRef.current?.offsetHeight || 600;

    const player = new rrwebPlayer({
      target: playerRef.current,
      props: {
        events,
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
    finishedRef.current = false;
    currentTimeRef.current = 0;

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
    setSkipInactive(false);

    let sessionStartTime = 0;
    try { sessionStartTime = player.getMetaData().startTime ?? 0; } catch {}

    try {
      const replayer = player.getReplayer();
      if (replayer) {
        replayer.on('event-cast', (event: any) => {
          if (typeof event?.timestamp === 'number' && sessionStartTime > 0) {
            const rel = event.timestamp - sessionStartTime;
            if (rel >= 0) setCurrentTime(rel);
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
          finishedRef.current = true;
          setIsPlaying(false);
        });
      }
    } catch {}

    return () => {
      try { (player as any).$destroy(); } catch {}
      playerInstanceRef.current = null;
    };
  }, [loading, events]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ─── Controls ──────────────────────────────────────────────────────────────
  const handleTogglePlay = useCallback(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    if (isPlayingRef.current) {
      player.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      // If the replay finished, player.play() restarts from the beginning.
      // Use goto() instead so it resumes from wherever the user seeked to.
      if (finishedRef.current) {
        finishedRef.current = false;
        const resumeAt = currentTimeRef.current >= totalTimeRef.current
          ? 0
          : currentTimeRef.current;
        player.goto(resumeAt, true);
      } else {
        player.play();
      }
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
    const newTime = Math.min(currentTimeRef.current + 10000, totalTimeRef.current);
    finishedRef.current = false;
    player.goto(newTime, isPlayingRef.current);
    currentTimeRef.current = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleSkipBack = useCallback(() => {
    const player = playerInstanceRef.current;
    if (!player) return;
    const newTime = Math.max(currentTimeRef.current - 10000, 0);
    finishedRef.current = false;
    player.goto(newTime, isPlayingRef.current);
    currentTimeRef.current = newTime;
    setCurrentTime(newTime);
  }, []);

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
    // Clear finished state: player.play() after a seek should resume from
    // the new position, not restart from the beginning.
    finishedRef.current = false;
    player.goto(newTime, isPlayingRef.current);
    currentTimeRef.current = newTime;
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
        <p className="text-xs text-muted-foreground/60 mt-1">Fetching session data...</p>
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
          {events.length === 0 ? (
            <div className="flex items-center justify-center h-full p-12 text-center">
              <div>
                <p className="text-sm font-medium text-white/30 mb-1">No events recorded</p>
                <p className="text-xs text-white/15">This session contains no replay data.</p>
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
