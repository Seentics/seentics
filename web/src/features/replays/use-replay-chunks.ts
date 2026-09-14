import { useEffect, useRef, useState } from 'react';
import { fetchGzipJsonArray, chunkLoadHint, eventsFromChunkList } from '@/features/replays/api';
import type { RRWebEvent, SessionCustomEvent } from '@/features/replays/types';
import {
  INITIAL_BATCH, CHUNK_CONCURRENCY, createLimiter, type ChunkProgress,
} from '@/features/replays/chunk-loading';

/** What the detail route needs from the session payload. Narrower than the full response. */
export interface ReplayChunkSource {
  replay_chunk_urls?: { sequence: number; url: string }[] | null;
  warm_chunks?: Array<{ sequence: number; data: unknown[] }> | null;
  replay_url?: string | null;
  recording_pending?: boolean;
}

export interface ReplayChunksState {
  initialEvents: RRWebEvent[];
  customEvents: SessionCustomEvent[];
  progress: ChunkProgress | null;
  error: string | null;
  /** True once the first S3 batch has settled — success, empty, or failure alike. */
  initialBatchDone: boolean;
  /** Set by the surface when rrweb-player mounts, so later chunks can stream in. */
  addEventsRef: React.MutableRefObject<((evs: RRWebEvent[]) => void) | null>;
  pendingEventsRef: React.MutableRefObject<RRWebEvent[]>;
}

/**
 * Progressive chunk loading for one recording.
 *
 * A recording is many immutable objects; the player needs the first few to start and the
 * rest can stream in behind it. That is a state machine — fetch an initial batch, hand it
 * to the player, keep loading the tail under a concurrency cap, and report progress —
 * and it was 170 lines of `useEffect` inside the route, where the only way to exercise
 * any of it was to open a session and watch.
 *
 * The two refs are returned rather than owned by the caller because the effect writes
 * through them: events that arrive before the player mounts queue in `pendingEventsRef`,
 * and `addEventsRef` is how the surface reports that it is ready to receive them.
 */
export function useReplayChunks(session: ReplayChunkSource | undefined): ReplayChunksState {
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
const chunkUrlsFingerprint = session?.replay_chunk_urls
  ?.map(c => c.sequence).join(',') ?? '';

useEffect(() => {
  if (!session) return;

  const urlRows = [...(session.replay_chunk_urls ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const warmChunks = session.warm_chunks;
  const bundleUrl  = session.replay_url;
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
}, [chunkUrlsFingerprint, session?.recording_pending]);

  return {
    initialEvents,
    customEvents,
    progress: chunkProgress,
    error: chunksError,
    initialBatchDone,
    addEventsRef,
    pendingEventsRef,
  };
}
