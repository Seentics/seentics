import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { assertOwnerOrMember } from "../services/access.service";
import * as replaySvc from "../services/replays.service";
import type { AuthVars } from "../middleware/auth";
import { authMiddleware, requireUser } from "../middleware/auth";
import { parseJson, parseQuery } from "../validators/validation";
import { replayBatchDeleteSchema, replayListQuerySchema } from "../validators/replays";
import { log } from "../lib/logger";

const replay_log = log.child({ category: "replays" });

export const replayRoutes = new Hono<{ Variables: AuthVars }>();

replayRoutes.use(authMiddleware);

replayRoutes.get("/:website_id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  const q = parseQuery(c, replayListQuerySchema);
  if (!q.ok) return q.res;
  const { limit, offset } = q.data;
  const out = await replaySvc.listReplaySessions(websiteId, limit, offset, { lenientResolve: true });
  return c.json(out);
});

replayRoutes.delete("/:website_id/batch", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  const parsed = await parseJson(c, replayBatchDeleteSchema);
  if (!parsed.ok) return parsed.res;
  const sessionIds = parsed.data.sessionIds;

  try {
    await replaySvc.batchDeleteReplaySessions(websiteId, sessionIds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    replay_log.error({ msg: "replay_delete_failed", website_id: websiteId, err: msg });
    return c.json({ error: "Failed to delete sessions" }, 500);
  }
  return c.json({ message: "sessions deleted" });
});

replayRoutes.get("/:website_id/:session_id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");
  const sessionId = c.req.param("session_id");
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  let d: Awaited<ReturnType<typeof replaySvc.getReplaySessionDetail>>;
  try {
    d = await replaySvc.getReplaySessionDetail(websiteId, sessionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    replay_log.error({ msg: "replay_load_failed", session_id: sessionId, website_id: websiteId, err: msg });
    return c.json({ error: "Failed to load replay" }, 500);
  }
  if (d.status === 404) return c.json(d.body, 404);
  return c.json(d.body);
});
