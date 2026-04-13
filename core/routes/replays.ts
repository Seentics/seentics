import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { env } from "../config";
import { assertOwnerOrMember } from "../lib/access";
import { getReplayEngine } from "../lib/replay-engine";
import {
  deleteSessionByEitherId,
  getSessionMeta,
  listSessions,
} from "../lib/replay-db";
import { presignGet, locateBundle, deleteSessionPrefix } from "../lib/s3";
import { resolveWebsiteIdsLenient } from "../lib/website-resolve";
import type { AuthVars } from "../middleware/auth";
import { authMiddleware, requireUser } from "../middleware/auth";
const replayNotReady = "replay recording is not available yet";

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

  let limit = Number(c.req.query("limit") ?? "20");
  let offset = Number(c.req.query("offset") ?? "0");
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > 500) limit = 500;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const { siteId, uuidStr } = await resolveWebsiteIdsLenient(websiteId);
  const sessions = await listSessions(siteId, uuidStr, limit, offset);
  const out = sessions.map((s) => ({
    sessionId: s.sessionId,
    websiteId: s.websiteId,
    browser: s.browser,
    device: s.device,
    os: s.os,
    country: s.country,
    entryPage: s.entryPage,
    startedAt: s.startedAt.toISOString(),
    hasRageClicks: s.hasRageClicks,
    hasErrors: s.hasErrors,
    durationSeconds: s.durationSeconds,
    pagesViewed: s.pagesViewed,
  }));

  return c.json({ sessions: out, limit, offset });
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

  const { siteId, uuidStr } = await resolveWebsiteIdsLenient(websiteId);
  const engine = getReplayEngine();
  const bucket = env().s3.bucket;

  for (const sid of sessionIds) {
    engine.removeSpool(siteId, sid);
    if (uuidStr !== siteId) engine.removeSpool(uuidStr, sid);
    await deleteSessionPrefix(bucket, siteId, sid);
    await deleteSessionByEitherId(siteId, uuidStr, sid);
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

  const { siteId, uuidStr } = await resolveWebsiteIdsLenient(websiteId);
  const engine = getReplayEngine();

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
        startedAt: metaRow.startedAt.toISOString(),
        hasRageClicks: metaRow.hasRageClicks,
        hasErrors: metaRow.hasErrors,
        durationSeconds: metaRow.durationSeconds,
        pagesViewed: metaRow.pagesViewed,
      }
    : null;

  const warm =
    engine.warmChunks(siteId, sessionId) ??
    (uuidStr !== siteId ? engine.warmChunks(uuidStr, sessionId) : null);

  if (warm && warm.some((ch) => ch.data?.length)) {
    return c.json({
      session_id: sessionId,
      meta,
      warm_chunks: warm.map((ch) => ({
        sequence: ch.sequence,
        data: ch.data,
        timestamp: ch.timestamp.toISOString(),
      })),
      recording_pending: false,
    });
  }

  const bucket = env().s3.bucket;
  const key = await locateBundle(bucket, siteId, uuidStr, sessionId);
  if (!key) {
    if (!meta) return c.json({ error: replayNotReady }, 404);
    return c.json({
      session_id: sessionId,
      meta,
      recording_pending: true,
    });
  }

  const expMs = env().presignTtlMs;
  const url = await presignGet(bucket, key, expMs);
  const deadline = new Date(Date.now() + expMs).toISOString();
  return c.json({
    session_id: sessionId,
    meta,
    replay_url: url,
    replay_url_expires_at: deadline,
    recording_pending: false,
  });
});
