/**
 * Chunk-loading policy for the replay player.
 *
 * A recording arrives as many immutable objects and the player needs the first few
 * before it can start. How many to fetch up front, how many at once, and how to report
 * progress are decisions independent of any component — and `createLimiter` in
 * particular is a small concurrency primitive that was impossible to test while it lived
 * inside a page.
 */
import type { RRWebEvent, SessionCustomEvent } from '@/features/replays/types';

export const INITIAL_BATCH = 2;

/** Parallel chunk downloads. Bounded so a long session does not open 60 sockets at once. */
export const CHUNK_CONCURRENCY = 5;

/** Stable identities: `events` drives a mount effect, so a fresh [] each render remounts. */
export const EMPTY_EVENTS: RRWebEvent[] = [];
export const EMPTY_CUSTOM_EVENTS: SessionCustomEvent[] = [];

export type ChunkProgress = {
  loaded: number;
  /** Chunks that failed twice and were skipped — the replay has gaps this many chunks wide. */
  failed: number;
  total: number;
};

/** Chunks that will not change again — downloaded, or skipped after retrying. */
export function settledChunks(p: ChunkProgress): number {
  return p.loaded + p.failed;
}

/** Progress over settled chunks, so a skipped one advances the bar instead of stalling it. */
export function progressPercent(p: ChunkProgress): number {
  if (p.total <= 0) return 0;
  return Math.min(100, Math.round((settledChunks(p) / p.total) * 100));
}

/** Runs at most `max` tasks at a time, preserving each caller's own promise. */
export function createLimiter(max: number) {
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
