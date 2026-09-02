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
import { cn, isValidId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ReplayPlaybackProvider,
  SessionReplaySurface,
  type SessionReplayBridge,
  type SessionReplaySurfaceAPI,
} from './session-replay-surface';
import { ReplaySessionSidebar } from './replay-session-sidebar';

export type { SessionReplaySurfaceAPI as ReplayPlayerAPI } from './session-replay-surface';

/** Chunks fetched before the player is mounted. Enough for playback to start immediately. */
const INITIAL_BATCH = 2;

/** Parallel chunk downloads. Bounded so a long session does not open 60 sockets at once. */
const CHUNK_CONCURRENCY = 5;

/** Stable identities: `events` drives a mount effect, so a fresh [] each render remounts. */
const EMPTY_EVENTS: RRWebEvent[] = [];
const EMPTY_CUSTOM_EVENTS: SessionCustomEvent[] = [];

type ChunkProgress = {
  loaded: number;
  /** Chunks that failed twice and were skipped — the replay has gaps this many chunks wide. */
  failed: number;
  total: number;
};

/** Chunks that will not change again — downloaded, or skipped after retrying. */
function settledChunks(p: ChunkProgress): number {
  return p.loaded + p.failed;
}

/** Progress over settled chunks, so a skipped one advances the bar instead of stalling it. */
function progressPercent(p: ChunkProgress): number {
  if (p.total <= 0) return 0;
  return Math.min(100, Math.round((settledChunks(p) / p.total) * 100));
}

/** Runs at most `max` tasks at a time, preserving each caller's own promise. */
function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>(resolve => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

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

  // Phase 2: progressive chunk loading state
  const [initialEvents, setInitialEvents] = useState<RRWebEvent[]>([]);
  const [customEvents, setCustomEvents] = useState<SessionCustomEvent[]>([]);
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(null);
  const [chunksError, setChunksError] = useState<string | null>(null);
  /** True once the initial S3 batch has been fetched and processed (success, empty, or error). */
  const [initialBatchDone, setInitialBatchDone] = useState(false);

  /** Populated when rrweb-player mounts; null between mount cycles. */
  const addEventsRef = useRef<((evs: RRWebEvent[]) => void) | null>(null);
  /** Queue for events that arrive before the player has mounted. */
  const pendingEventsRef = useRef<RRWebEvent[]>([]);

  // Stable fingerprint so the effect only re-runs when the chunk list actually changes
  const chunkUrlsFingerprint = sessionApiResp?.replay_chunk_urls
    ?.map(c => c.sequence).join(',') ?? '';

  useEffect(() => {
    if (!sessionApiResp) return;

    const urlRows = [...(sessionApiResp.replay_chunk_urls ?? [])].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const warmChunks = sessionApiResp.warm_chunks;
    const bundleUrl  = sessionApiResp.replay_url;
    const total      = urlRows.length;

    setInitialEvents([]);
    setCustomEvents([]);
    setChunkProgress(null);
    setChunksError(null);
    setInitialBatchDone(false);
    addEventsRef.current = null;
    pendingEventsRef.current = [];

    if (total === 0 && !warmChunks?.length && !bundleUrl) return;

    let cancelled = false;

    (async () => {
      // Warm-chunks-only or legacy bundle: load everything at once (no incremental gain)
      if (total === 0) {
        let chunks: Array<{ sequence: number; data: unknown[] }> = [];
        if (warmChunks?.length) chunks = [...warmChunks];
        if (!chunks.length && bundleUrl) {
          try {
            const raw = await fetchGzipJsonArray(bundleUrl);
            chunks = [{ sequence: 0, data: raw as unknown[] }];
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!cancelled) {
              setChunksError(`Could not load replay bundle (${msg}). ${chunkLoadHint(msg)}`);
              setInitialBatchDone(true);
            }
            return;
          }
        }
        if (cancelled) return;
        const { events, customEvents: cevs } = eventsFromChunkList(chunks);
        setInitialEvents(events);
        setCustomEvents(cevs);
        setInitialBatchDone(true);
        return;
      }

      // One transient failure (network blip, presign race) shouldn't lose a chunk:
      // a missing middle chunk is a silent replay gap, and a missing FIRST chunk
      // (the one with the FullSnapshot) makes playback blank.
      const fetchChunkWithRetry = async (row: { sequence: number; url: string }) => {
        try {
          return { sequence: row.sequence, data: (await fetchGzipJsonArray(row.url)) as unknown[] };
        } catch {
          return { sequence: row.sequence, data: (await fetchGzipJsonArray(row.url)) as unknown[] };
        }
      };

      // Fetch initial batch to unblock the player
      setChunkProgress({ loaded: 0, failed: 0, total });
      const initBatch = urlRows.slice(0, INITIAL_BATCH);
      const initResults = await Promise.allSettled(initBatch.map(fetchChunkWithRetry));
      if (cancelled) return;

      const initChunks = initResults
        .filter((r): r is PromiseFulfilledResult<{ sequence: number; data: unknown[] }> => r.status === 'fulfilled')
        .map(r => r.value);

      // Only successes count. Advancing the bar for a chunk that never arrived reported
      // a replay as fully loaded while it was missing whole stretches of the session.
      let loaded = initChunks.length;
      let failed = initResults.length - initChunks.length;
      setChunkProgress({ loaded, failed, total });

      // The lowest-sequence chunk carries the initial FullSnapshot — without it the
      // player renders a blank page, so treat its loss as fatal, not partial.
      const firstChunkFailed = initResults[0]?.status === 'rejected';
      if (initChunks.length === 0 || firstChunkFailed) {
        const failure = initResults.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        const msg = failure?.reason instanceof Error ? failure.reason.message : String(failure?.reason ?? 'failed');
        setChunksError(`Could not load replay from storage (${msg}). ${chunkLoadHint(msg)}`);
        setInitialBatchDone(true);
        return;
      }

      // NOTE: warm chunks (the in-memory tail — the NEWEST events) must NOT be merged
      // into the initial set. replayer.addEvent() is rrweb's live-mode append and
      // assumes chronologically increasing events; mounting the tail first and then
      // streaming older S3 chunks after it corrupts the timeline. Warm events are
      // appended last, after every S3 chunk has streamed in.
      const { events: initEvs, customEvents: initCevs } = eventsFromChunkList(initChunks);
      setInitialEvents(initEvs);
      setCustomEvents(initCevs);
      setInitialBatchDone(true);

      /**
       * Hand a streamed chunk to the player and the sidebar.
       *
       * Both halves, not just the rrweb events: `customEvents` is what the Console,
       * Network and Errors panels render, and dropping it here meant those panels only
       * ever showed the initial batch — roughly the first minute of a session, silently.
       */
      const appendStreamed = (evs: RRWebEvent[], cevs: SessionCustomEvent[]) => {
        if (evs.length > 0) {
          if (addEventsRef.current) addEventsRef.current(evs);
          else pendingEventsRef.current.push(...evs);
        }
        if (cevs.length > 0) setCustomEvents(prev => [...prev, ...cevs]);
      };

      /**
       * Fetch the rest concurrently but append strictly in sequence order.
       *
       * Sequential awaits meant one round trip per chunk: at the 30s flush window a
       * half-hour session is ~60 objects, so time-to-complete was ~60 serial fetches.
       * The append order still has to be monotonic — `addEvent` is rrweb's live-mode
       * path — so the results are awaited in order even though they race.
       */
      const runLimited = createLimiter(CHUNK_CONCURRENCY);
      const rest = urlRows.slice(INITIAL_BATCH);
      const inFlight = rest.map(row =>
        runLimited(() => fetchChunkWithRetry(row)).then(
          value => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: null }),
        ),
      );

      for (const pending of inFlight) {
        const result = await pending;
        if (cancelled) return;
        if (result.ok) {
          const { events: newEvs, customEvents: newCevs } = eventsFromChunkList([
            { sequence: result.value.sequence, data: result.value.data },
          ]);
          appendStreamed(newEvs, newCevs);
          loaded += 1;
        } else {
          // Skipped after two attempts. Partial playback beats none, but the gap is
          // reported rather than hidden behind a progress bar that reaches 100%.
          failed += 1;
        }
        setChunkProgress({ loaded, failed, total });
      }

      // Finally append the warm in-memory tail (newest events, sequence > all S3 chunks)
      if (!cancelled && warmChunks?.length) {
        const { events: warmEvs, customEvents: warmCevs } = eventsFromChunkList(warmChunks);
        appendStreamed(warmEvs, warmCevs);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkUrlsFingerprint, sessionApiResp?.recording_pending]);

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
    metaLoading ||
    (!sessionApiResp && !isError) ||
    // API responded with chunk data but initial S3 batch not yet fetched/processed
    (chunkDataAvailable && !initialBatchDone && !chunksError && !sessionApiResp?.recording_pending);

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
      <div className="w-full shrink-0 border-b border-border backdrop-blur-md">
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
            ) : !hasRecording ? (
              <div className="flex flex-1 min-h-[240px] flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Video className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-semibold text-foreground">No recording for this session</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isDemoMode ? (
                      'Demo mode has no sample recording. Enable replay on a live site to see playback here.'
                    ) : hasNonRrwebSignals ? (
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
