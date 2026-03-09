'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Monitor, Smartphone, Tablet, Globe, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReplayPlayer from '@/components/replays/ReplayPlayer';
import api from '@/lib/api';

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
        setSession(list.find(s => s.session_id === sessionId) ?? null);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [websiteId, sessionId]);

  const DeviceIcon = session?.device === 'mobile' ? Smartphone : session?.device === 'tablet' ? Tablet : Monitor;
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => router.push(`/websites/${websiteId}/replays`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-4 w-px bg-border shrink-0" />
          <p className="text-sm font-medium shrink-0">Session Replay</p>
          <div className="flex-1" />
          {session && (
            <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <DeviceIcon className="h-3 w-3 shrink-0" />
                {session.browser} · {session.device}
              </span>
              {session.country && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3 shrink-0" />
                    {session.country}
                  </span>
                </>
              )}
              {session.duration_seconds > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    {formatDuration(session.duration_seconds)}
                  </span>
                </>
              )}
              {session.entry_page && (
                <>
                  <span className="text-border hidden md:inline">·</span>
                  <span className="text-xs text-muted-foreground font-mono hidden md:block truncate max-w-[200px]">{session.entry_page}</span>
                </>
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
