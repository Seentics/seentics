'use client';

import React, { useEffect, useRef, useState } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Monitor, Globe, Clock, Shield, Smartphone, Tablet, RefreshCw } from 'lucide-react';
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

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function val(v: string | undefined | null, fallback = '—'): string {
  if (!v || v === 'Unknown') return fallback;
  return v;
}

export default function ReplayPlayer({ sessionId, websiteId, session }: ReplayPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<any[]>([]);

  useEffect(() => {
    const fetchReplayData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/replays/data/${sessionId}?website_id=${websiteId}`);
        const data = response.data;
        const allEvents = data.chunks.flatMap((chunk: any) => chunk.data);
        setChunks(allEvents);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch replay data');
        setLoading(false);
      }
    };

    fetchReplayData();
  }, [sessionId, websiteId]);

  useEffect(() => {
    if (!loading && chunks.length > 0 && playerRef.current) {
      playerRef.current.innerHTML = '';
      new rrwebPlayer({
        target: playerRef.current,
        props: {
          events: chunks,
          autoPlay: true,
          width: playerRef.current.offsetWidth || 1024,
          height: 800, // Increased default height
          UNSAFE_replayCanvas: true // Performance
        },
      });
    }
  }, [loading, chunks]);

  const getDeviceIcon = () => {
    if (!session?.device) return Monitor;
    const d = session.device.toLowerCase();
    if (d.includes('mobile') || d.includes('phone')) return Smartphone;
    if (d.includes('tablet') || d.includes('ipad')) return Tablet;
    return Monitor;
  };

  const DeviceIcon = getDeviceIcon();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-muted/20 rounded-xl border border-border/60">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40 mb-3" />
        <span className="text-sm font-medium text-muted-foreground">Loading session data...</span>
        <p className="text-xs text-muted-foreground/60 mt-1">Reconstructing timeline from recorded events</p>
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
        /* Fix for full-page scaling */
        .re-player__container {
          height: auto !important;
          min-height: 600px !important;
        }
        .rr-controller {
          background: rgba(9, 9, 11, 0.95) !important;
          backdrop-filter: blur(12px) !important;
          border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
          padding: 10px 16px !important;
          height: auto !important;
        }
        .rr-timeline {
          height: 4px !important;
          background: rgba(255, 255, 255, 0.08) !important;
          border-radius: 2px !important;
          margin-bottom: 10px !important;
        }
        .rr-progress {
          background: #3b82f6 !important;
          border-radius: 2px !important;
        }
        .rr-progress__handler {
          width: 12px !important;
          height: 12px !important;
          border: 2px solid #3b82f6 !important;
          background: #fff !important;
        }
        .rr-controller__btns {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        .rr-controller__btns button {
          width: 28px !important;
          height: 28px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 6px !important;
          transition: background 0.15s !important;
          background: rgba(255, 255, 255, 0.04) !important;
        }
        .rr-controller__btns button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .rr-controller__btns svg {
          fill: rgba(255, 255, 255, 0.7) !important;
          width: 16px !important;
          height: 16px !important;
        }
        .rr-controller__timer {
          color: rgba(255, 255, 255, 0.5) !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          letter-spacing: 0.02em !important;
        }
      `}</style>

      {/* Player */}
      <Card className="border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="bg-zinc-950 flex items-center justify-center relative overflow-hidden min-h-[600px] max-h-[85vh]">
          {chunks.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-white/30 mb-1">No events recorded</p>
              <p className="text-xs text-white/15">This session contains no replay data.</p>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <div ref={playerRef} className="w-full h-full min-h-[600px]" />
            </div>
          )}
        </div>
      </Card>

      {/* Session metadata */}
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
