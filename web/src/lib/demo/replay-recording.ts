/**
 * The demo session's recording.
 *
 * A real rrweb recording of a scripted visit to Northbound, a made-up shop, made by
 * `scripts/demo-replay/record.mjs`. Every demo session id plays it: the list's rows
 * are generated, and there is one recording behind them.
 */
import type { ReplaySession, RRWebEvent } from '@/features/replays/types';
import { demoDate } from './fixture-utils';

export const DEMO_REPLAY_URL = '/demo/replay-session.json';

/** What the recorded visit was. Duration comes from the events, so a re-record can't drift from it. */
export function demoReplaySessionMeta(sessionId: string, websiteId: string, events: RRWebEvent[]): ReplaySession {
  const durationMs = events.length > 1 ? events[events.length - 1].timestamp - events[0].timestamp : 0;
  return {
    sessionId,
    websiteId,
    country: 'Canada',
    browser: 'Chrome',
    device: 'Desktop',
    os: 'macOS',
    entryPage: '/',
    startedAt: demoDate(-300_000).toISOString(),
    durationSeconds: Math.round(durationMs / 1000),
    pagesViewed: 3,
    hasRageClicks: true,
    hasErrors: true,
  };
}
