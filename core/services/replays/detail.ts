import { env } from "../../config";
import { getReplayEngine } from "../../lib/replay-engine";
import { getSessionMeta } from "../../lib/replay-db";
import { presignGet, locateBundle, getJsonGzip, listSessionReplayChunks } from "../../lib/s3";
import { compareReplayEnvelopeEvents } from "../../lib/replay-event-order";
import { resolveWebsiteIdsLenient } from "../../lib/website-resolve";
import { replayNotReady, timestampToIso } from "./shared";

/** Merge chunk listings from canonical site id and uuid folder (legacy paths). */
async function collectSessionChunkRows(
  bucket: string,
  siteId: string,
  uuidStr: string,
  sessionId: string,
): Promise<{ sequence: number; key: string }[]> {
  const bySeq = new Map<number, string>();
  const ingest = async (wid: string) => {
    const rows = await listSessionReplayChunks(bucket, wid, sessionId);
    for (const r of rows) {
      if (!bySeq.has(r.sequence)) bySeq.set(r.sequence, r.key);
    }
  };
  await ingest(siteId);
  if (uuidStr !== siteId) await ingest(uuidStr);
  return [...bySeq.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sequence, key]) => ({ sequence, key }));
}

export type ReplayChunkUrlRow = {
  sequence: number;
  url: string;
  expires_at: string;
};

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
        replay_chunk_urls: ReplayChunkUrlRow[];
        warm_chunks?: { sequence: number; data: unknown; timestamp: string }[];
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
  const expMs = cfg.presignTtlMs;
  const deadline = new Date(Date.now() + expMs).toISOString();

  const chunkRows = await collectSessionChunkRows(bucket, siteId, uuidStr, sessionId);

  const warmFlat: Record<string, unknown>[] = [];
  if (warm) {
    for (const ch of warm) {
      if (Array.isArray(ch.data)) warmFlat.push(...(ch.data as Record<string, unknown>[]));
    }
  }

  /** Time-based immutable chunks + optional in-memory tail. */
  if (chunkRows.length > 0) {
    const replay_chunk_urls: ReplayChunkUrlRow[] = await Promise.all(
      chunkRows.map(async ({ sequence, key }) => ({
        sequence,
        url: await presignGet(bucket, key, expMs),
        expires_at: deadline,
      })),
    );
    const maxSeq = chunkRows[chunkRows.length - 1]!.sequence;
    const warmSeq = maxSeq + 1;
    const warm_chunks =
      warmFlat.length > 0
        ? [
            {
              sequence: warmSeq,
              data: warmFlat as unknown[],
              timestamp: timestampToIso(new Date()),
            },
          ]
        : undefined;
    return {
      status: 200,
      body: {
        session_id: sessionId,
        meta,
        replay_chunk_urls,
        ...(warm_chunks ? { warm_chunks } : {}),
        recording_pending: false,
      },
    };
  }

  const key = await locateBundle(bucket, siteId, uuidStr, sessionId);

  /** Legacy single bundle merged with warm tail. */
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

  const url = await presignGet(bucket, key, expMs);
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
