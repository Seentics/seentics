'use client';

import 'rrweb/dist/style.css';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Video,
  Copy,
  Link2,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { getSessionWithEvents, type ReplaySession } from '@/lib/replays-api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ReplayPlaybackProvider,
  SessionReplaySurface,
  type SessionReplayBridge,
  type SessionReplaySurfaceAPI,
} from './session-replay-surface';
import { ReplaySessionSidebar } from './replay-session-sidebar';

export type { SessionReplaySurfaceAPI as ReplayPlayerAPI } from './session-replay-surface';

export default function ReplayDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const websiteId = params?.websiteId as string;
  const sessionId = params?.sessionId as string;
  const isDemoMode = isDemo(websiteId);

  const playerApiRef = useRef<SessionReplaySurfaceAPI | null>(null);
  const [replayBridge, setReplayBridge] = useState<SessionReplayBridge | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['replay', websiteId, sessionId],
    queryFn: () => getSessionWithEvents(websiteId, sessionId),
    enabled: !!websiteId && !!sessionId && !isDemoMode,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const session = isDemoMode
    ? ({
        country: 'Canada',
        browser: 'Chrome',
        device: 'Desktop',
        os: 'macOS',
        entryPage: '/',
        startedAt: new Date().toISOString(),
        durationSeconds: 120,
        pagesViewed: 3,
        hasRageClicks: false,
        hasErrors: false,
        sessionId,
        websiteId,
      } as ReplaySession)
    : data?.meta ?? undefined;

  const events       = isDemoMode ? [] : (data?.events ?? []);
  const customEvents = isDemoMode ? [] : (data?.customEvents ?? []);

  const copyShareLink = useCallback(() => {
    const full = typeof window !== 'undefined' ? window.location.href : '';
    void navigator.clipboard.writeText(full).then(() => {
      toast({ title: 'Link copied', description: 'Anyone with access can open this replay.' });
    });
  }, [toast]);

  const copyId = useCallback(() => {
    void navigator.clipboard.writeText(sessionId).then(() => {
      toast({ title: 'Session ID copied' });
    });
  }, [sessionId, toast]);

  const listHref = `/websites/${websiteId}/replays`;
  const hasRecording = events.length > 0;

  useEffect(() => {
    setReplayBridge(null);
  }, [websiteId, sessionId]);

  useEffect(() => {
    if (!hasRecording || isLoading) {
      setReplayBridge(null);
    }
  }, [hasRecording, isLoading]);

  useEffect(() => {
    if (events.length === 0) return;

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;

      const api = playerApiRef.current;
      if (!api) return;

      if (e.code === 'Space') {
        e.preventDefault();
        api.toggle();
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        api.toggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [events.length]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col basis-0">
      <div className="w-full shrink-0 border-b border-border/60 backdrop-blur-md">
        <div className="w-full px-3 py-2 md:px-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0 -ml-2"
              onClick={() => router.push(listHref)}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Replays
            </Button>

            <div className="hidden h-4 w-px bg-border/50 sm:block shrink-0" />

            <Video className="h-3.5 w-3.5 text-primary shrink-0 hidden sm:block" />

            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="min-w-0 text-xs font-semibold font-mono text-foreground truncate sm:text-sm"
                title={sessionId}
              >
                {sessionId}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                title="Copy session ID"
                onClick={copyId}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="min-w-2 flex-1 basis-2 sm:basis-auto" />

            {!isDemoMode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Copy link to this replay"
                onClick={copyShareLink}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {session?.hasErrors && (
              <Badge
                variant="outline"
                title="Set when a JavaScript error or unhandled promise rejection fired in the visitor’s browser while recording was on. Does not include console warnings or failed network requests."
                className="text-[10px] shrink-0 border-red-500/50 text-red-800 dark:text-red-300 bg-red-500/10"
              >
                Client errors
              </Badge>
            )}

            {session?.hasRageClicks && (
              <Badge
                variant="outline"
                title="Set when we detect 3 or more clicks within about 1 second inside roughly 50×50 px in the recording—the same rule as the amber dots on the session timeline."
                className="text-[10px] shrink-0 border-amber-500/50 text-amber-800 dark:text-amber-300 bg-amber-500/10"
              >
                Rage clicks
              </Badge>
            )}

            {isDemoMode && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                Demo
              </Badge>
            )}
          </div>
        </div>
      </div>

      <ReplayPlaybackProvider bridge={replayBridge}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-stretch overflow-x-hidden">
          {/* Player must stay first in the column; avoid flex-1 on this row when a recording exists — it can reorder/stack oddly with overflow + min-height. */}
          <div
            className={cn(
              'flex min-w-0 w-full flex-col',
              hasRecording ? 'shrink-0 px-3 pt-3 sm:px-5 sm:pt-4' : 'min-h-0 flex-1 basis-0 px-3 pb-3 pt-2 sm:px-4',
            )}
          >
            {isLoading ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-xs font-medium text-muted-foreground">Loading recording…</p>
              </div>
            ) : !hasRecording ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Video className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-semibold text-foreground">No recording for this session</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isDemoMode
                      ? 'Demo mode has no sample recording. Enable replay on a live site to see playback here.'
                      : 'The capture may have been too short, blocked in the browser, or replay disabled for this site.'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(listHref)}>
                  Back to replays
                </Button>
              </div>
            ) : (
              <SessionReplaySurface
                className="mt-0 flex min-w-0 w-full flex-col sm:!mt-0"
                events={events}
                customEvents={customEvents}
                websiteId={websiteId}
                sessionSummary={
                  session
                    ? {
                        entryPage: session.entryPage,
                        hasErrors: Boolean(session.hasErrors),
                        hasRageClicks: Boolean(session.hasRageClicks),
                      }
                    : undefined
                }
                onReady={(api) => {
                  playerApiRef.current = api;
                }}
                onBridgeReady={setReplayBridge}
              />
            )}
          </div>

          {hasRecording ? (
            <ReplaySessionSidebar
              replayBridge={replayBridge}
              session={session ?? null}
              websiteId={websiteId}
            />
          ) : null}
        </div>
      </ReplayPlaybackProvider>
    </div>
  );
}
