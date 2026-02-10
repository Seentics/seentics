'use client';

import React, { useEffect, useRef, useState } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Monitor, MapPin, Clock } from 'lucide-react';
import api from '@/lib/api';

interface ReplayPlayerProps {
  sessionId: string;
  websiteId: string;
}

export default function ReplayPlayer({ sessionId, websiteId }: ReplayPlayerProps) {
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
                height: 576,
            },
        });
    }
  }, [loading, chunks]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 bg-accent/5 rounded-xl border-2 border-dashed">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <span className="text-xl font-bold">Initializing Cinema Mode...</span>
        <p className="text-muted-foreground mt-2 font-medium">Reconstructing session from timeline chunks</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-destructive/5 text-destructive rounded-2xl border-2 border-destructive/20 max-w-2xl mx-auto shadow-xl">
        <h3 className="text-xl font-black mb-4 flex items-center gap-2">
            <span className="p-2 bg-destructive/10 rounded-lg">⚠️</span>
            Playback Error
        </h3>
        <p className="font-bold opacity-80 mb-6">{error}</p>
        <Button onClick={() => window.location.reload()} className="font-bold px-8" variant="destructive">
          Retry Playback
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <style>{`
        .rr-player {
            border: none !important;
            background: #0a0a0a !important;
        }
        .rr-controller {
            background: rgba(10, 10, 10, 0.95) !important;
            backdrop-filter: blur(8px) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
            padding: 12px 20px !important;
            height: auto !important;
        }
        .rr-timeline {
            height: 6px !important;
            background: rgba(255, 255, 255, 0.1) !important;
            border-radius: 4px !important;
            margin-bottom: 12px !important;
        }
        .rr-progress {
            background: #3b82f6 !important; /* Blue-500 */
            border-radius: 4px !important;
        }
        .rr-controller__btns {
            display: flex !important;
            align-items: center !important;
            gap: 16px !important;
        }
        .rr-controller__btns button {
            width: 32px !important;
            height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 8px !important;
            transition: all 0.2s !important;
            background: rgba(255, 255, 255, 0.05) !important;
        }
        .rr-controller__btns button:hover {
            background: rgba(255, 255, 255, 0.15) !important;
            transform: scale(1.05) !important;
        }
        .rr-controller__btns svg {
            fill: #fff !important;
            width: 18px !important;
            height: 18px !important;
        }
        .rr-controller__timer {
            color: rgba(255, 255, 255, 0.8) !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            font-family: inherit !important;
            letter-spacing: 0.05em !important;
        }
        .rr-controller__sep {
            border-color: rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>

      <div className="bg-card border rounded-xl overflow-hidden shadow-xl transition-all border-primary/10">
        <div className="bg-muted/30 p-4 border-b flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Monitor className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h3 className="font-bold text-base tracking-tight">Session Replay</h3>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase opacity-60">{sessionId}</p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-0.5">Stream Status</span>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-green-600">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span>Live Reconstruction</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-0 bg-neutral-950 aspect-video flex items-center justify-center relative shadow-inner overflow-hidden">
            {chunks.length === 0 ? (
                <div className="p-12 text-center">
                    <p className="text-xl font-bold text-white/40 mb-2">NO EVENTS DETECTED</p>
                    <p className="text-xs font-medium text-white/20 uppercase tracking-[0.2em]">Zero mutation signals captured</p>
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                     <div ref={playerRef} className="w-full h-full"></div>
                </div>
            )}
            
            <div className="absolute bottom-4 right-4 pointer-events-none">
                <div className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[9px] font-bold text-white/40 tracking-[0.1em] uppercase">
                    Playback Engine v2.0
                </div>
            </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border shadow-md bg-muted/20 rounded-xl">
            <CardHeader className="p-4 pb-2">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Metadata</p>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex items-center justify-between font-bold text-xs">
                    <span className="text-muted-foreground">Network</span>
                    <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        Active
                    </span>
                </div>
                <div className="flex items-center justify-between font-bold text-xs">
                    <span className="text-muted-foreground">Protocol</span>
                    <span>HTTPS / RRWeb</span>
                </div>
            </CardContent>
        </Card>
        
        <Card className="border shadow-md bg-muted/20 rounded-xl col-span-2">
            <CardHeader className="p-4 pb-2">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Privacy Compliance</p>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <p className="text-xs font-medium opacity-70 leading-relaxed">
                    Captured using <span className="font-bold text-primary">Intelligent Masking</span>. PII and sensitive inputs are redacted at the edge before telemetry is transmitted to our servers.
                </p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
