'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  ArrowLeft, Play, Pause, SkipBack, FastForward,
  Monitor, Smartphone, Tablet, AlertTriangle, Globe,
  Clock, Layers, MousePointer, Gauge,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { demoReplaySession } from '@/lib/demo/replays';
import { getSessionWithEvents, type RRWebEvent, type ReplaySession } from '@/lib/replays-api';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase();
  if (d === 'mobile') return <Smartphone className="h-4 w-4" />;
  if (d === 'tablet') return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

// ─── Player component ─────────────────────────────────────────────────────────
function RRWebPlayerView({
  events,
  onDurationReady,
}: {
  events: RRWebEvent[];
  onDurationReady: (ms: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const replayerRef  = useRef<any>(null);
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);   // ms from start
  const [duration, setDuration] = useState(0);   // total ms
  const [speed,    setSpeed]    = useState(1);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive duration from event timestamps
  const startTs = events.length > 0 ? events[0].timestamp : 0;
  const endTs   = events.length > 0 ? events[events.length - 1].timestamp : 0;
  const totalMs = endTs - startTs;

  useEffect(() => {
    if (!containerRef.current || events.length === 0) return;

    // Dynamically import Replayer (client-side only, avoid SSR)
    import('rrweb').then(({ Replayer }) => {
      // Tear down previous instance
      if (replayerRef.current) {
        try { replayerRef.current.destroy?.(); } catch (_) {}
        containerRef.current!.innerHTML = '';
      }

      const replayer = new Replayer(events as any, {
        root:         containerRef.current!,
        speed:        1,
        triggerFocus: false,
        mouseTail: {
          duration:    500,
          lineCap:     'round' as CanvasLineCap,
          lineWidth:   3,
          strokeStyle: 'rgba(99,102,241,0.6)',
        },
        liveMode: false,
      } as any);

      replayerRef.current = replayer;

      const dur = endTs - startTs;
      setDuration(dur);
      onDurationReady(dur);

      replayer.on('finish', () => setPlaying(false));

      // Kick off — but don't auto-play
      replayer.pause(0);
    });

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (replayerRef.current) {
        try { replayerRef.current.destroy?.(); } catch (_) {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Tick timer to update progress bar
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!playing) return;
    tickRef.current = setInterval(() => {
      if (!replayerRef.current) return;
      try {
        const t = replayerRef.current.getCurrentTime?.() ?? 0;
        setCurrent(t);
        if (t >= totalMs) {
          setPlaying(false);
          clearInterval(tickRef.current!);
        }
      } catch (_) {}
    }, 250);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [playing, totalMs]);

  const togglePlay = useCallback(() => {
    if (!replayerRef.current) return;
    if (playing) {
      replayerRef.current.pause();
      setPlaying(false);
    } else {
      replayerRef.current.play(current);
      setPlaying(true);
    }
  }, [playing, current]);

  const seek = useCallback((ms: number) => {
    if (!replayerRef.current) return;
    setCurrent(ms);
    if (playing) {
      replayerRef.current.play(ms);
    } else {
      replayerRef.current.pause(ms);
    }
  }, [playing]);

  const skipBack = () => seek(Math.max(0, current - 10000));
  const skipFwd  = () => seek(Math.min(totalMs, current + 10000));

  const cycleSpeed = () => {
    const speeds = [0.5, 1, 1.5, 2, 4];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (replayerRef.current) replayerRef.current.setConfig?.({ speed: next });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* rrweb iframe area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden [&_iframe]:w-full [&_iframe]:h-full [&_.replayer-wrapper]:w-full [&_.replayer-wrapper]:h-full"
        style={{ minHeight: 0 }}
      />

      {/* Controls bar */}
      <div className="shrink-0 bg-[#111] border-t border-white/10 px-4 py-3 space-y-2">
        {/* Progress slider */}
        <Slider
          min={0}
          max={totalMs || 1}
          step={100}
          value={[current]}
          onValueChange={([v]) => seek(v)}
          className="h-1.5"
        />
        {/* Buttons + time */}
        <div className="flex items-center gap-2">
          <button
            onClick={skipBack}
            className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Skip back 10s"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={togglePlay}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            {playing
              ? <Pause className="h-4 w-4 fill-white" />
              : <Play  className="h-4 w-4 fill-white ml-0.5" />}
          </button>
          <button
            onClick={skipFwd}
            className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Skip forward 10s"
          >
            <FastForward className="h-4 w-4" />
          </button>

          <span className="text-[11px] font-mono text-white/50 ml-1">
            {fmtMs(current)} / {fmtMs(totalMs)}
          </span>

          <div className="flex-1" />

          <button
            onClick={cycleSpeed}
            className="h-7 px-2 rounded text-[11px] font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Cycle playback speed"
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Demo player placeholder ──────────────────────────────────────────────────
function DemoPlayerPlaceholder({ duration }: { duration: number }) {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Play className="h-7 w-7 text-primary fill-primary ml-0.5" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">Demo Mode</p>
          <p className="text-xs text-white/40 mt-1 max-w-[240px]">
            Install the Seentics tracker on your site to record real sessions.
          </p>
        </div>
      </div>
      <div className="shrink-0 bg-[#111] border-t border-white/10 px-4 py-3 space-y-2">
        <div className="h-1.5 bg-white/10 rounded-full" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-white/10" />
          <span className="text-[11px] font-mono text-white/30">
            0:00 / {fmtMs(duration * 1000)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReplayDetailPage() {
  const params    = useParams();
  const router    = useRouter();
  const websiteId = params?.websiteId as string;
  const sessionId = params?.sessionId as string;
  const isDemoMode = isDemo(websiteId);

  const [playerDuration, setPlayerDuration] = useState(0);

  // Demo: use static data. Real: fetch from API.
  const demoSession = isDemoMode ? demoReplaySession(sessionId) : null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['replay', websiteId, sessionId],
    queryFn:  () => getSessionWithEvents(websiteId, sessionId),
    enabled:  !isDemoMode,
    staleTime: 5 * 60 * 1000,
  });

  const session: ReplaySession | null = isDemoMode
    ? {
        sessionId:     demoSession!.session_id,
        websiteId:     demoSession!.website_id,
        browser:       demoSession!.browser,
        device:        demoSession!.device,
        os:            demoSession!.os,
        country:       demoSession!.country,
        entryPage:     demoSession!.entry_page,
        startedAt:     demoSession!.start_time,
        hasRageClicks: demoSession!.has_rage_clicks,
      }
    : data?.meta ?? null;

  const events = isDemoMode ? [] : (data?.events ?? []);
  const duration = isDemoMode
    ? demoSession!.duration_seconds * 1000
    : playerDuration || (events.length > 1
        ? events[events.length - 1].timestamp - events[0].timestamp
        : 0);

  const infoRows = session ? [
    { label: 'Entry',    value: session.entryPage || '/' },
    { label: 'Browser',  value: session.browser },
    { label: 'OS',       value: session.os },
    { label: 'Device',   value: session.device },
    { label: 'Country',  value: session.country },
    { label: 'Started',  value: new Date(session.startedAt).toLocaleString() },
    { label: 'Duration', value: fmtMs(duration) },
    { label: 'Events',   value: events.length || (isDemoMode ? demoSession!.events_count : '—') },
  ] : [];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-[52px] border-b border-border/60 bg-card">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/replays`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Replays
        </Button>
        <div className="w-px h-4 bg-border/60" />
        {session && (
          <>
            <DeviceIcon device={session.device} />
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
              {session.country}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">{session.browser}</Badge>
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">{session.os}</Badge>
          </>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {fmtMs(duration)}
          </span>
          <span className="flex items-center gap-1.5">
            <MousePointer className="h-3.5 w-3.5" />
            {events.length || (isDemoMode ? demoSession?.events_count : 0)} events
          </span>
        </div>
        {session?.hasRageClicks && (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-200/50 dark:text-orange-400 text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1" /> Rage Clicks
          </Badge>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Player */}
        <div className="flex-1 overflow-hidden">
          {isDemoMode ? (
            <DemoPlayerPlaceholder duration={demoSession!.duration_seconds} />
          ) : isLoading ? (
            <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-xs text-white/40">Loading recording…</p>
              </div>
            </div>
          ) : isError || events.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
              <div className="text-center space-y-2">
                <p className="text-sm text-white/50">No recording data available</p>
                <p className="text-xs text-white/30">
                  Make sure the tracker is installed and recording is enabled.
                </p>
              </div>
            </div>
          ) : (
            <RRWebPlayerView
              events={events}
              onDurationReady={setPlayerDuration}
            />
          )}
        </div>

        {/* Info sidebar */}
        <div className="w-[220px] shrink-0 border-l border-border/60 bg-card overflow-y-auto">
          <div className="px-4 py-3 border-b border-border/40">
            <p className="text-xs font-semibold text-foreground">Session Info</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{sessionId}</p>
          </div>
          <div className="divide-y divide-border/30">
            {infoRows.map(row => (
              <div key={row.label} className="flex items-start justify-between px-4 py-2.5 gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">{row.label}</span>
                <span className="text-[11px] font-medium text-foreground text-right truncate">{String(row.value)}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-3 px-4 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recording</p>
            <div className="space-y-1.5">
              {[
                { icon: Gauge,       label: 'Chunks',  value: isDemoMode ? '—' : data?.events ? '✓ Loaded' : '—' },
                { icon: Layers,      label: 'Format',  value: 'rrweb v2' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-[11px]">
                  <item.icon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="ml-auto font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
