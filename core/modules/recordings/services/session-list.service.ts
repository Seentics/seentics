import { listSessions } from "../repositories/recording.repository";
import { clampListParams, timestampToIso } from "./shared";

/**
 * Recorded sessions for a website, newest first.
 *
 * Takes both resolved identifiers because recording rows are keyed by whichever
 * one the tracker sent; the repository matches on either. Resolution itself is
 * `RecordingService`'s job, done once per request through the websites port.
 */
export async function listReplaySessions(
  websiteId: string,
  limit: number,
  offset: number,
) {
  const { limit: lim, offset: off } = clampListParams(limit, offset);
  const sessions = await listSessions(websiteId, lim, off);
  const out = sessions.map((s) => ({
    sessionId: s.sessionId,
    websiteId: s.websiteId,
    browser: s.browser,
    device: s.device,
    os: s.os,
    country: s.country,
    entryPage: s.entryPage,
    startedAt: timestampToIso(s.startedAt),
    hasRageClicks: s.hasRageClicks,
    hasErrors: s.hasErrors,
    durationSeconds: s.durationSeconds,
    pagesViewed: s.pagesViewed,
  }));
  return { sessions: out, limit: lim, offset: off };
}

/**
 * Raw API variant: snake_case rows for that surface's response shape.
 *
 * Takes both resolved identifiers, like its sibling above. The raw API's key
 * middleware already resolved the website in order to authenticate the request, so
 * resolving again here was a second lookup for an answer the caller was holding.
 */
export async function listReplaySessionsRaw(
  websiteId: string,
  limit: number,
  offset: number,
) {
  const { limit: lim, offset: off } = clampListParams(limit, offset);
  const sessions = await listSessions(websiteId, lim, off);
  return {
    limit: lim,
    offset: off,
    sessions: sessions.map((s) => ({
      session_id: s.sessionId,
      website_id: s.websiteId,
      browser: s.browser,
      device: s.device,
      os: s.os,
      country: s.country,
      entry_page: s.entryPage,
      started_at: timestampToIso(s.startedAt),
      duration_seconds: s.durationSeconds,
      pages_viewed: s.pagesViewed,
      has_rage_clicks: s.hasRageClicks,
      has_errors: s.hasErrors,
    })),
  };
}
