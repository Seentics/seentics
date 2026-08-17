import { env } from "../../config";
import { getReplayEngine } from "../../lib/replay-engine";
import { deleteSessionByEitherId } from "../../lib/replay-db";
import { deleteSessionPrefix } from "../../lib/s3";
import { resolveWebsiteIdsLenient } from "../../lib/website-resolve";

export async function batchDeleteReplaySessions(websiteParam: string, sessionIds: string[]) {
  const { siteId, uuidStr } = await resolveWebsiteIdsLenient(websiteParam);
  const engine = getReplayEngine();
  const bucket = env().s3.bucket;

  // Remove all in-memory spools first (synchronous, no await)
  for (const sid of sessionIds) {
    engine.removeSpool(siteId, sid);
    if (uuidStr !== siteId) engine.removeSpool(uuidStr, sid);
  }

  // Delete S3 objects and DB records for all sessions in parallel
  await Promise.all(
    sessionIds.map(async (sid) => {
      try {
        await deleteSessionPrefix(bucket, siteId, sid);
      } catch {
        // S3 delete is best-effort — still remove the DB record
      }
      await deleteSessionByEitherId(siteId, uuidStr, sid);
    }),
  );
}
