'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Globe, Monitor, Smartphone, Tablet, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReplayPlayer from '@/components/replays/ReplayPlayer';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface SessionMeta {
  session_id: string;
  website_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  chunk_count: number;
  browser: string;
  device: string;
  os: string;
  country: string;
  entry_page: string;
}

function val(v: string | undefined | null, fallback = '—'): string {
  if (!v || v === 'Unknown') return fallback;
  return v;
}

function formatDuration(seconds: number): string {
  const s = Math.min(Math.round(seconds), 3600);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

function getDeviceIcon(device: string) {
  const d = (device || '').toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return Smartphone;
  if (d.includes('tablet') || d.includes('ipad')) return Tablet;
  return Monitor;
}

export default function SessionPlaybackPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const sessionId = params?.sessionId as string;

  const [session, setSession] = useState<SessionMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!websiteId || !sessionId) return;
    const load = async () => {
      try {
        const res = await api.get(`/replays/sessions?website_id=${websiteId}&limit=200`);
        const list: SessionMeta[] = res.data?.sessions || [];
        const found = list.find(s => s.session_id === sessionId) ?? null;
        setSession(found);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [websiteId, sessionId]);

  const DeviceIcon = getDeviceIcon(session?.device ?? '');

  const timeAgo = (() => {
    try {
      if (!session?.start_time) return null;
      const d = new Date(session.start_time);
      return isNaN(d.getTime()) ? null : formatDistanceToNow(d, { addSuffix: true });
    } catch { return null; }
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => router.push(`/websites/${websiteId}/replays`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Session Replay</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate hidden sm:block">
                {sessionId?.slice(0, 20)}...
              </p>
            </div>
          </div>

          {session && (
            <div className="flex items-center gap-2 shrink-0">
              {/* device badge */}
              <Badge variant="outline" className="gap-1.5 text-xs hidden md:flex">
                <DeviceIcon className="h-3 w-3" />
                {val(session.browser)} · {val(session.device, 'Desktop')}
              </Badge>
              {/* location */}
              {session.country && session.country !== 'Unknown' && (
                <Badge variant="outline" className="gap-1.5 text-xs hidden md:flex">
                  <Globe className="h-3 w-3" />
                  {session.country}
                </Badge>
              )}
              {/* duration */}
              <Badge variant="outline" className="gap-1.5 text-xs">
                <Clock className="h-3 w-3" />
                {formatDuration(session.duration_seconds)}
              </Badge>
              {/* entry page link */}
              {session.entry_page && (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hidden sm:flex" asChild>
                  <a href={session.entry_page} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    {session.entry_page.length > 30 ? session.entry_page.slice(0, 30) + '…' : session.entry_page}
                  </a>
                </Button>
              )}
              {timeAgo && (
                <span className="text-xs text-muted-foreground hidden lg:block">{timeAgo}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Loading session...</p>
          </div>
        ) : (
          <ReplayPlayer sessionId={sessionId} websiteId={websiteId} session={session} />
        )}
      </div>
    </div>
  );
}
