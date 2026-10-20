'use client';

import { usePathSegment } from '@/lib/path-segment';

import 'rrweb/dist/style.css';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppNavigation } from '@/lib/embed-nav';
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
  type RRWebEvent,
  type SessionCustomEvent,
} from '@/lib/replays-api';
import { useReplayChunks } from '@/features/replays/use-replay-chunks';
import { ReplayDetailHeader } from '@/components/replays/ReplayDetailHeader';
import { DemoReplayPlayer } from '@/components/replays/DemoReplayStage';
import { noRecordingReason } from '@/components/replays/no-recording';
import { DEMO_REPLAY_URL, demoReplaySessionMeta } from '@/lib/demo/replay-recording';
import { cn, isValidId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import {
  ReplayPlaybackProvider,
  SessionReplaySurface,
  type SessionReplayBridge,
  type SessionReplaySurfaceAPI,
  PLAYER_MAX_HEIGHT,
  PLAYER_ASPECT,
} from '@/components/replays/session-replay-surface';
import { ReplaySessionSidebar } from '@/components/replays/replay-session-sidebar';

export type { SessionReplaySurfaceAPI as ReplayPlayerAPI } from '@/components/replays/session-replay-surface';

/** Chunks fetched before the player is mounted. Enough for playback to start immediately. */
import {
  INITIAL_BATCH, CHUNK_CONCURRENCY, EMPTY_EVENTS, EMPTY_CUSTOM_EVENTS,
  settledChunks, progressPercent, createLimiter, type ChunkProgress,
} from '@/features/replays/chunk-loading';

export default function ReplayDetailPage() {
  return <ReplayDetailView />;
}

/** One recording: the signed-in page, and the same page inside an embed (which names its own site and session). */
export function ReplayDetailView({
  websiteId: websiteIdProp,
  sessionId: sessionIdProp,
  embed = false,
}: {
  websiteId?: string;
  sessionId?: string;
  /** Inside an embed: read-only, and no session insight panel (the embed API does not serve it). */
  embed?: boolean;
}) {
  const router = useAppNavigation();
  const { toast } = useToast();
  const m = useT().replays;
  const t = m.detail;
  const siteSegment = usePathSegment(1);
  const sessionSegment = usePathSegment(3);
  const websiteId = websiteIdProp ?? siteSegment ?? '';
  const sessionId = sessionIdProp ?? sessionSegment ?? '';
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

  // Demo mode: one real rrweb recording shipped as a static file (see
  // scripts/demo-replay/record.mjs), parsed exactly as a chunk from storage is.
  const { data: demoRecording, isLoading: demoLoading, isError: demoError } = useQuery({
    queryKey: ['replay-demo-recording'],
    queryFn: async () => {
      const res = await fetch(DEMO_REPLAY_URL);
      if (!res.ok) throw new Error(`Demo recording fetch failed: ${res.status}`);
      return eventsFromChunkList([{ sequence: 0, data: (await res.json()) as unknown[] }]);
    },
    enabled: isDemoMode,
    staleTime: Infinity,
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
  } = useReplayChunks(sessionApiResp, websiteId);

  // Pre-warm rrweb-player bundle while metadata is loading
  useEffect(() => {
    if (metaLoading && !isDemoMode) void import('rrweb-player');
  }, [metaLoading, isDemoMode]);

  const chunkDataAvailable = !!(
    (sessionApiResp?.replay_chunk_urls?.length ?? 0) > 0 ||
    sessionApiResp?.replay_url ||
    (sessionApiResp?.warm_chunks?.length ?? 0) > 0
  );
  const isLoading = isDemoMode
    // Demo mode only waits for its own file. The metadata query is disabled there, so
    // `sessionApiResp` stays undefined and `isError` stays false forever — the clauses
    // below would leave the demo spinning on "Loading recording…".
    ? demoLoading
    : (metaLoading ||
      (!sessionApiResp && !isError) ||
      // API responded with chunk data but initial S3 batch not yet fetched/processed
      (chunkDataAvailable && !initialBatchDone && !chunksError && !sessionApiResp?.recording_pending));

  const session = isDemoMode
    ? demoReplaySessionMeta(sessionId, websiteId, demoRecording?.events ?? EMPTY_EVENTS)
    : sessionApiResp?.meta ?? undefined;

  const events            = isDemoMode ? demoRecording?.events ?? EMPTY_EVENTS : initialEvents;
  /**
   * The tabs under the player share its width — 16:9 at the tallest the window allows (the
   * player's own limit) — so their edges line up. Never narrower than 64rem, so the console
   * and network rows have room. 2.5rem is the padding either side, which the player's limit
   * does not include.
   */
  const tabsMaxWidth = `calc(max(${PLAYER_MAX_HEIGHT} * ${PLAYER_ASPECT}, 64rem) + 2.5rem)`;
  const sessionSignals    = isDemoMode ? demoRecording?.customEvents ?? EMPTY_CUSTOM_EVENTS : customEvents;
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
      toast({ title: t.linkCopied, description: t.linkCopiedBody });
    });
  }, [toast, t]);

  const listHref = `/websites/${websiteId}/replays`;
  const hasRecording = events.length > 0;
  /** Session queue payloads without a parseable rrweb DOM stream (e.g. only client errors, or empty bundle). */
  /** What the empty state says, from how long the visit was and what was captured instead. */
  const noRecording = noRecordingReason({
    durationSeconds: session?.durationSeconds,
    signalTypes: sessionSignals.map((e) => e.eventType),
  }, m);

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
        context={
          session
            ? {
                country: session.country,
                browser: session.browser,
                os: session.os,
                device: session.device,
                durationSeconds: session.durationSeconds,
              }
            : undefined
        }
        hasErrors={session?.hasErrors}
        hasRageClicks={session?.hasRageClicks}
        isDemo={isDemoMode}
        onBack={() => router.push(listHref)}
        onCopyShareLink={copyShareLink}
      />

      <ReplayPlaybackProvider bridge={replayBridge}>
        {/*
          The player on top at every width, the session's tabs under it. Side by side, the
          tab column took ~360px from the player, which is width-bound on most screens, so
          the recording played smaller than the window allowed.
        */}
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
                    ? t.loadingChunks(chunkProgress.loaded, chunkProgress.total)
                    : t.loading}
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
                  <p className="text-sm font-semibold text-foreground">{t.loadFailed}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {chunksError ?? (queryError instanceof Error
                      ? queryError.message
                      : t.loadFailedBody)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(listHref)}>
                  {t.backToReplays}
                </Button>
              </div>
            ) : recordingPending ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Video className="h-7 w-7 text-primary/60" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-semibold text-foreground">{t.preparing}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t.preparingBody}
                    {' '}<span className="font-mono text-[11px]">replay spool: bundle upload failed</span>
                    {' '}{t.preparingAnd} <span className="font-mono text-[11px]">S3_*</span> {t.preparingSettings}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['replay', websiteId, sessionId] })}
                  >
                    {t.retryNow}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(listHref)}>
                    {t.backToReplays}
                  </Button>
                </div>
              </div>
            ) : isDemoMode && (demoError || !hasRecording) ? (
              /*
               * Demo mode plays a real recording through the real player below. Only if
               * that file cannot be loaded does it fall back to this still of a session,
               * which beats an error on the screen a visitor is evaluating replays on.
               */
              <DemoReplayPlayer />
            ) : !hasRecording ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Video className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-semibold text-foreground">{noRecording.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{noRecording.body}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(listHref)}>
                  {t.backToReplays}
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
                      {t.gaps(missingChunks, chunkProgress?.total ?? missingChunks)}
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
            <div className="mx-auto w-full" style={{ maxWidth: tabsMaxWidth }}>
              <ReplaySessionSidebar
                replayBridge={replayBridge}
                session={session ?? null}
                websiteId={websiteId}
                analysisSessionId={!embed ? sessionId : undefined}
              />
            </div>
          ) : null}
        </div>
      </ReplayPlaybackProvider>
    </div>
  );
}
