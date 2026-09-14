'use client';

import 'rrweb/dist/style.css';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ArrowLeft,
  Video,
  Copy,
  Link2,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import {
  getSessionApiResponse,
  fetchGzipJsonArray,
  eventsFromChunkList,
  chunkLoadHint,
  type ReplaySession,
  type RRWebEvent,
  type SessionCustomEvent,
} from '@/lib/replays-api';
import { useReplayChunks } from '@/features/replays/use-replay-chunks';
import { ReplayDetailHeader } from '@/components/replays/ReplayDetailHeader';
import { DemoReplayPlayer } from '@/components/replays/DemoReplayStage';
import { cn, isValidId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ReplayPlaybackProvider,
  SessionReplaySurface,
  type SessionReplayBridge,
  type SessionReplaySurfaceAPI,
} from '@/components/replays/session-replay-surface';
import { ReplaySessionSidebar } from '@/components/replays/replay-session-sidebar';

export type { SessionReplaySurfaceAPI as ReplayPlayerAPI } from '@/components/replays/session-replay-surface';

/** Chunks fetched before the player is mounted. Enough for playback to start immediately. */
import {
  INITIAL_BATCH, CHUNK_CONCURRENCY, EMPTY_EVENTS, EMPTY_CUSTOM_EVENTS,
  settledChunks, progressPercent, createLimiter, type ChunkProgress,
} from '@/features/replays/chunk-loading';

export default function ReplayDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const websiteId = params?.websiteId as string;
  const sessionId = params?.sessionId as string;
  const isDemoMode = isDemo(websiteId);

  const playerApiRef = useRef<SessionReplaySurfaceAPI | null>(null);
  const [replayBridge, setReplayBridge] = useState<SessionReplayBridge | null>(null);
  const queryClient = useQueryClient();

  // Phase 1: fetch session metadata + signed chunk URLs (fast — no S3 bytes)
  const { data: sessionApiResp, isLoading: metaLoading, isError, error: queryError } = useQuery({
    queryKey: ['replay', websiteId, sessionId],
    queryFn: () => getSessionApiResponse(websiteId, sessionId),
    enabled: isValidId(websiteId) && !!sessionId && !isDemoMode,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchInterval: (q) => (q.state.data?.recording_pending ? 3500 : false),
  });

  // Phase 2: progressive chunk loading — see `features/replays/use-replay-chunks`.
  const {
    initialEvents,
    customEvents,
    progress: chunkProgress,
    error: chunksError,
    initialBatchDone,
    addEventsRef,
    pendingEventsRef,
  } = useReplayChunks(sessionApiResp);

  // Pre-warm rrweb-player bundle while metadata is loading
  useEffect(() => {
    if (metaLoading && !isDemoMode) void import('rrweb-player');
  }, [metaLoading, isDemoMode]);

  const chunkDataAvailable = !!(
    (sessionApiResp?.replay_chunk_urls?.length ?? 0) > 0 ||
    sessionApiResp?.replay_url ||
    (sessionApiResp?.warm_chunks?.length ?? 0) > 0
  );
  const isLoading =
    // Never in demo mode. The metadata query is disabled there, so `sessionApiResp`
    // stays undefined and `isError` stays false forever — which made the second
    // clause permanently true and left the demo player spinning on
    // "Loading recording…" instead of showing the demo session.
    !isDemoMode &&
    (metaLoading ||
      (!sessionApiResp && !isError) ||
      // API responded with chunk data but initial S3 batch not yet fetched/processed
      (chunkDataAvailable && !initialBatchDone && !chunksError && !sessionApiResp?.recording_pending));

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
    : sessionApiResp?.meta ?? undefined;

  const events            = isDemoMode ? EMPTY_EVENTS : initialEvents;
  const sessionSignals    = isDemoMode ? EMPTY_CUSTOM_EVENTS : customEvents;
  const recordingPending  = !isDemoMode && (sessionApiResp?.recording_pending === true);
  /** Chunks that never arrived. Playback still works; it just has holes in it. */
  const missingChunks     = chunkProgress?.failed ?? 0;

  const handlePlayerReady = useCallback((api: SessionReplaySurfaceAPI) => {
    playerApiRef.current = api;
    // Wire the streaming addEvents ref
    addEventsRef.current = (evs: RRWebEvent[]) => api.addEvents(evs);
    // Flush events that arrived before the player was ready
    if (pendingEventsRef.current.length > 0) {
      api.addEvents(pendingEventsRef.current);
      pendingEventsRef.current = [];
    }
  }, []);

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
  /** Session queue payloads without a parseable rrweb DOM stream (e.g. only client errors, or empty bundle). */
  const hasNonRrwebSignals = !isDemoMode && !hasRecording && sessionSignals.length > 0;

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
      <ReplayDetailHeader
        sessionId={sessionId}
        hasErrors={session?.hasErrors}
        hasRageClicks={session?.hasRageClicks}
        isDemo={isDemoMode}
        onBack={() => router.push(listHref)}
        onCopyId={copyId}
        onCopyShareLink={copyShareLink}
      />

      <ReplayPlaybackProvider bridge={replayBridge}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-stretch overflow-x-hidden">
          {/* Player must stay first in the column; avoid flex-1 on this row when a recording exists — it can reorder/stack oddly with overflow + min-height. */}
          <div
            className={cn(
              'flex min-w-0 w-full flex-col',
              // Demo counts as having a recording for layout: it renders a player, so
              // it wants the player's padding rather than the empty state's centring.
              hasRecording || isDemoMode
                ? 'shrink-0 px-3 pt-3 sm:px-5 sm:pt-4'
                : 'min-h-0 flex-1 basis-0 px-3 pb-3 pt-2 sm:px-4',
            )}
          >
            {isLoading ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-xs font-medium text-muted-foreground">
                  {chunkProgress && chunkProgress.total > 1
                    ? `Loading recording… ${chunkProgress.loaded} / ${chunkProgress.total} chunks`
                    : 'Loading recording…'}
                </p>
                {chunkProgress && chunkProgress.total > 1 && (
                  <div className="w-40 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${progressPercent(chunkProgress)}%` }}
                    />
                  </div>
                )}
              </div>
            ) : !isDemoMode && (isError || chunksError) ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Video className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-semibold text-foreground">Couldn&apos;t load replay</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {chunksError ?? (queryError instanceof Error
                      ? queryError.message
                      : 'The session may have been deleted, the API returned an error (for example 404), or the recording bytes could not be read from storage.')}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(listHref)}>
                  Back to replays
                </Button>
              </div>
            ) : recordingPending ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Video className="h-7 w-7 text-primary/60" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-semibold text-foreground">Preparing recording…</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Replay bytes are written to object storage shortly after recording goes idle (usually within about a minute).
                    If this never finishes, the analytics core may not reach MinIO/S3—check core logs for
                    {' '}<span className="font-mono text-[11px]">replay spool: bundle upload failed</span>
                    {' '}and verify <span className="font-mono text-[11px]">S3_*</span> / MinIO settings.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['replay', websiteId, sessionId] })}
                  >
                    Retry now
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(listHref)}>
                    Back to replays
                  </Button>
                </div>
              </div>
            ) : isDemoMode ? (
              /*
               * The demo session, playing.
               *
               * Demo mode has no rrweb bytes in object storage, so this used to be an
               * empty state apologising for the missing recording — which meant the
               * one visitor most likely to be evaluating replays was the one who never
               * saw what they look like. Shared with the landing page's preview, so
               * both stay the same screen.
               */
              <DemoReplayPlayer />
            ) : !hasRecording ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Video className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-semibold text-foreground">No recording for this session</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {hasNonRrwebSignals ? (
                      <>
                        We stored client-side signals (for example JavaScript errors) for this visit, but there is no
                        rrweb DOM recording. Usually{' '}
                        <span className="font-medium text-foreground/90">rrweb.js failed to load</span> (wrong URL,
                        blocked by an extension, or CSP),{' '}
                        <span className="font-medium text-foreground/90">session recording is off</span> for the site,
                        or the tracker never finished init before the visitor left.
                      </>
                    ) : (
                      <>
                        The replay list counts every session row we have in the database; playback only works when
                        rrweb events were captured and uploaded. Common causes:{' '}
                        <span className="font-medium text-foreground/90">replay disabled</span>,{' '}
                        <span className="font-medium text-foreground/90">monthly recording cap reached</span>,{' '}
                        <span className="font-medium text-foreground/90">object storage upload failed</span> on the
                        analytics core, or the visit was too short for a full snapshot to flush.
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(listHref)}>
                  Back to replays
                </Button>
              </div>
            ) : (
              <>
                {/* Non-blocking streaming progress bar — shows while background chunks load */}
                {chunkProgress && settledChunks(chunkProgress) < chunkProgress.total && (
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent(chunkProgress)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {chunkProgress.loaded}/{chunkProgress.total}
                    </span>
                  </div>
                )}

                {/*
                  Chunks that failed twice are skipped so the rest of the session still
                  plays — but silently skipping them showed a complete-looking replay with
                  stretches missing from the middle. Say so.
                */}
                {missingChunks > 0 && (
                  <div
                    role="status"
                    className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2"
                  >
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                      {missingChunks} of {chunkProgress?.total ?? missingChunks} segments couldn&apos;t be
                      loaded, so this replay has gaps. Reloading may recover them; if it does not,
                      check object storage access for this session.
                    </p>
                  </div>
                )}
                <SessionReplaySurface
                  className="mt-0 flex min-w-0 w-full flex-col sm:!mt-0"
                  events={events}
                  customEvents={sessionSignals}
                  websiteId={websiteId}
                  knownDurationMs={(session?.durationSeconds ?? 0) * 1000 || undefined}
                  sessionSummary={
                    session
                      ? {
                          entryPage: session.entryPage,
                          hasErrors: Boolean(session.hasErrors),
                          hasRageClicks: Boolean(session.hasRageClicks),
                        }
                      : undefined
                  }
                  onReady={handlePlayerReady}
                  onBridgeReady={setReplayBridge}
                />
              </>
            )}
          </div>

          {/* Demo included: the tabs carry the session summary, which is the half of
              this screen that explains who the visitor was. Without it the demo shows
              a player floating on an empty page. */}
          {hasRecording || isDemoMode ? (
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
