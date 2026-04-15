import { env } from "../../config";
import { getReplayEngine } from "../../lib/replay-engine";
import { getSessionMeta } from "../../lib/replay-db";
import { presignGet, locateBundle, getJsonGzip } from "../../lib/s3";
import { compareReplayEnvelopeEvents } from "../../lib/replay-event-order";
import { resolveWebsiteIdsLenient } from "../../lib/website-resolve";
import { replayNotReady, timestampToIso } from "./shared";

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
