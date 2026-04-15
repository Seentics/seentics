import { listSessions } from "../../lib/replay-db";
import { resolveWebsiteIds, resolveWebsiteIdsLenient } from "../../lib/website-resolve";
import { clampListParams, timestampToIso } from "./shared";

export async function listReplaySessions(
  websiteParam: string,
  limit: number,
  offset: number,
  opts: { lenientResolve: boolean },
) {
  const { limit: lim, offset: off } = clampListParams(limit, offset);
  const { siteId, uuidStr } = opts.lenientResolve
    ? await resolveWebsiteIdsLenient(websiteParam)
    : await resolveWebsiteIds(websiteParam);
  const sessions = await listSessions(siteId, uuidStr, lim, off);
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

/** Raw API: snake_case rows + ids for meta envelope. */
export async function listReplaySessionsRaw(websiteParam: string, limit: number, offset: number) {
  const { siteId, uuidStr } = await resolveWebsiteIds(websiteParam);
  const { limit: lim, offset: off } = clampListParams(limit, offset);
  const sessions = await listSessions(siteId, uuidStr, lim, off);
  return {
    siteId,
    uuidStr,
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
