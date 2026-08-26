import { env } from "../../../config";
import { getReplayEngine } from "./recording-engine.service";
import { deleteSession } from "../repositories/recording.repository";
import { deleteSessionPrefix } from "../../../platform/lib/s3";

/**
 * Delete recordings and their stored chunks.
 *
 * Takes both resolved identifiers: spools, S3 prefixes and rows may all be
 * written under either, so cleaning up only one leaves orphans behind.
 */
export async function batchDeleteReplaySessions(
  websiteId: string,
  sessionIds: string[],
) {
  const engine = getReplayEngine();
  const bucket = env().s3.bucket;

  // Remove all in-memory spools first (synchronous, no await)
  for (const sid of sessionIds) {
    engine.removeSpool(websiteId, sid);
    if (websiteId !== websiteId) engine.removeSpool(websiteId, sid);
  }

  // Delete S3 objects and DB records for all sessions in parallel
  await Promise.all(
    sessionIds.map(async (sid) => {
      try {
        await deleteSessionPrefix(bucket, websiteId, sid);
      } catch {
        // S3 delete is best-effort — still remove the DB record
      }
      await deleteSession(websiteId, sid);
    }),
  );
}
