import { env } from "../config";
import { getReplayEngine } from "../lib/replay-engine";
import { deleteSessionByEitherId, getSessionMeta, listSessions } from "../lib/replay-db";
import { presignGet, locateBundle, deleteSessionPrefix, getJsonGzip } from "../lib/s3";
import { compareReplayEnvelopeEvents } from "../lib/replay-event-order";
import { resolveWebsiteIds, resolveWebsiteIdsLenient } from "../lib/website-resolve";

const replayNotReady = "replay recording is not available yet";

/** Raw `postgres` rows often return timestamps as strings; warm chunks may use `Date`. */
function timestampToIso(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  const d = new Date(v as string | number);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return new Date(0).toISOString();
}

function clampListParams(limit: number, offset: number) {
  let l = limit;
  let o = offset;
  if (!Number.isFinite(l) || l < 1) l = 20;
  if (l > 500) l = 500;
  if (!Number.isFinite(o) || o < 0) o = 0;
  return { limit: l, offset: o };
}

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

export async function batchDeleteReplaySessions(websiteParam: string, sessionIds: string[]) {
  const { siteId, uuidStr } = await resolveWebsiteIdsLenient(websiteParam);
  const engine = getReplayEngine();
  const bucket = env().s3.bucket;

  for (const sid of sessionIds) {
    engine.removeSpool(siteId, sid);
    if (uuidStr !== siteId) engine.removeSpool(uuidStr, sid);
    await deleteSessionPrefix(bucket, siteId, sid);
    await deleteSessionByEitherId(siteId, uuidStr, sid);
  }
}

export type ReplaySessionDetail =
  | {
      status: 200;
      body: {
        session_id: string;
        meta: {
          sessionId: string;
          websiteId: string;
          browser: string;
          device: string;
          os: string;
          country: string;
          entryPage: string;
          startedAt: string;
          hasRageClicks: boolean;
          hasErrors: boolean;
          durationSeconds: number;
          pagesViewed: number;
        } | null;
        warm_chunks: { sequence: number; data: unknown; timestamp: string }[];
        recording_pending: false;
      };
    }
  | {
      status: 200;
      body: {
        session_id: string;
        meta: {
          sessionId: string;
          websiteId: string;
          browser: string;
          device: string;
          os: string;
          country: string;
          entryPage: string;
          startedAt: string;
          hasRageClicks: boolean;
          hasErrors: boolean;
          durationSeconds: number;
          pagesViewed: number;
        } | null;
        recording_pending: true;
      };
    }
  | {
      status: 200;
      body: {
        session_id: string;
        meta: {
          sessionId: string;
          websiteId: string;
          browser: string;
          device: string;
          os: string;
          country: string;
          entryPage: string;
          startedAt: string;
          hasRageClicks: boolean;
          hasErrors: boolean;
          durationSeconds: number;
          pagesViewed: number;
        } | null;
        replay_url: string;
        replay_url_expires_at: string;
        recording_pending: false;
      };
    }
  | { status: 404; body: { error: string } };

export async function getReplaySessionDetail(
  websiteParam: string,
  sessionId: string,
): Promise<ReplaySessionDetail> {
  const { siteId, uuidStr } = await resolveWebsiteIdsLenient(websiteParam);
  const engine = getReplayEngine();
  const cfg = env();

  const metaRow = await getSessionMeta(siteId, uuidStr, sessionId);
  const meta = metaRow
    ? {
        sessionId: metaRow.sessionId,
        websiteId: metaRow.websiteId,
        browser: metaRow.browser,
        device: metaRow.device,
        os: metaRow.os,
        country: metaRow.country,
        entryPage: metaRow.entryPage,
        startedAt: timestampToIso(metaRow.startedAt),
        hasRageClicks: metaRow.hasRageClicks,
        hasErrors: metaRow.hasErrors,
        durationSeconds: metaRow.durationSeconds,
        pagesViewed: metaRow.pagesViewed,
      }
    : null;

  const warm =
    engine.warmChunks(siteId, sessionId) ??
    (uuidStr !== siteId ? engine.warmChunks(uuidStr, sessionId) : null);

  const bucket = cfg.s3.bucket;
  const key = await locateBundle(bucket, siteId, uuidStr, sessionId);

  const warmFlat: Record<string, unknown>[] = [];
  if (warm) {
    for (const ch of warm) {
      if (Array.isArray(ch.data)) warmFlat.push(...(ch.data as Record<string, unknown>[]));
    }
  }

  /** Warm buffer must merge with finalized S3 bytes; returning warm alone used to drop everything already uploaded. */
  if (warmFlat.length > 0) {
    let s3Events: Record<string, unknown>[] | null = null;
    if (key) {
      try {
        s3Events = await getJsonGzip(bucket, key);
      } catch {
        s3Events = null;
      }
    }
    const merged: Record<string, unknown>[] = [];
    if (s3Events?.length) merged.push(...s3Events);
    merged.push(...warmFlat);
    merged.sort(compareReplayEnvelopeEvents);
    return {
      status: 200,
      body: {
        session_id: sessionId,
        meta,
        warm_chunks: [
          {
            sequence: 0,
            data: merged as unknown[],
            timestamp: timestampToIso(new Date()),
          },
        ],
        recording_pending: false,
      },
    };
  }

  if (!key) {
    if (!meta) return { status: 404, body: { error: replayNotReady } };
    return {
      status: 200,
      body: {
        session_id: sessionId,
        meta,
        recording_pending: true,
      },
    };
  }

  const expMs = cfg.presignTtlMs;
  const url = await presignGet(bucket, key, expMs);
  const deadline = new Date(Date.now() + expMs).toISOString();
  return {
    status: 200,
    body: {
      session_id: sessionId,
      meta,
      replay_url: url,
      replay_url_expires_at: deadline,
      recording_pending: false,
    },
  };
}
