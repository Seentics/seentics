import { env } from "../../../../config";
import { getJsonGzip, listSessionReplayChunks, locateBundle } from "../../../../platform/storage/s3";

/**
 * Most chunks read for one analysis.
 *
 * A chunk is one ingest batch, typically a few seconds of activity, and the tracker caps a
 * session at 30 minutes — so this is far past a normal recording. Past it the analysis
 * covers the start of the session and says it was truncated, rather than a pathological
 * recording holding a worker and its memory.
 */
export const MAX_ANALYSIS_CHUNKS = 600;
const CONCURRENCY = 4;

export type LoadedRecording = { rows: unknown[]; chunks: number; truncated: boolean };

/**
 * Every stored event of one session, in chunk order: the immutable per-batch chunks, or a
 * legacy single bundle. `null` when storage holds nothing for the session yet.
 *
 * Read once per analysis. The result is stored, so neither the list, the summary nor the
 * assistant downloads the recording again.
 */
export async function loadRecordingEvents(
  websiteId: string,
  sessionId: string,
  maxChunks: number = MAX_ANALYSIS_CHUNKS,
): Promise<LoadedRecording | null> {
  const bucket = env().s3.bucket;
  const listed = await listSessionReplayChunks(bucket, websiteId, sessionId);
  const bySeq = new Map<number, string>();
  for (const c of listed) if (!bySeq.has(c.sequence)) bySeq.set(c.sequence, c.key);
  const keys = [...bySeq.entries()].sort((a, b) => a[0] - b[0]).map(([, key]) => key);

  if (keys.length === 0) {
    const bundle = await locateBundle(bucket, websiteId, sessionId);
    if (!bundle) return null;
    return { rows: await getJsonGzip(bucket, bundle), chunks: 1, truncated: false };
  }

  const wanted = keys.slice(0, maxChunks);
  const parts: unknown[][] = new Array(wanted.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= wanted.length) return;
      parts[i] = await getJsonGzip(bucket, wanted[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, worker));
  return { rows: parts.flat(), chunks: wanted.length, truncated: keys.length > wanted.length };
}
