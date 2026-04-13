import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { assertOwnerOrMember } from "../services/access.service";
import * as replaySvc from "../services/replays.service";
import type { AuthVars } from "../middleware/auth";
import { authMiddleware, requireUser } from "../middleware/auth";

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

  const limit = Number(c.req.query("limit") ?? "20");
  const offset = Number(c.req.query("offset") ?? "0");
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

  const body = await c.req.json<{ sessionIds?: string[] }>();
  const sessionIds = body.sessionIds;
  if (!sessionIds?.length) return c.json({ error: "sessionIds must not be empty" }, 400);
  if (sessionIds.length > 500) return c.json({ error: "sessionIds exceeds maximum of 500" }, 400);

  await replaySvc.batchDeleteReplaySessions(websiteId, sessionIds);
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

  const d = await replaySvc.getReplaySessionDetail(websiteId, sessionId);
  if (d.status === 404) return c.json(d.body, 404);
  return c.json(d.body);
});
