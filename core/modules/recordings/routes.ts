import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { log } from "../../platform/lib/logger";
import { parseJson, parseQuery } from "../../platform/validation";
import type { WebsiteQuery } from "../websites/interfaces";
import type { RecordingMutations, RecordingQuery } from "./interfaces";
// Imported from the schema module rather than a barrel: these are `z.preprocess`
// schemas whose inferred output widens when re-exported, which silently costs the
// handlers their parameter types.
import { replayBatchDeleteSchema, replayListQuerySchema } from "./validators/recording.schema";

const recording_log = log.child({ category: "recordings" });

/**
 * HTTP surface for session recordings, mounted at `/api/v1/replays`.
 *
 * The path keeps the `replays` spelling the web client already calls; see
 * `interfaces/recording.interface.ts` on why the rename stops at the module edge.
 */
export function createRecordingRoutes(deps: {
  recordings: RecordingQuery & RecordingMutations;
  websites: WebsiteQuery;
}) {
  const { recordings, websites } = deps;
  const r = new Hono<{ Variables: AuthVars }>();

  r.use(authMiddleware);

  /**
   * Authenticate and confirm the caller may see this website's recordings.
   *
   * Returns a `Response` to short-circuit with, or `null` to proceed. Answers 403
   * for an unknown website as well as a forbidden one, so the endpoint cannot be
   * used to probe which site ids exist.
   *
   * Recordings are among the most sensitive data in the product — they replay what
   * a real visitor did on screen — so this guard runs on every route here,
   * including the delete.
   */
  async function denyUnlessPermitted(
    c: Context<{ Variables: AuthVars }>,
    websiteRef: string,
  ): Promise<Response | null> {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "forbidden" }, 403);

    const role = await websites.getRole(websiteRef, userId);
    if (!role) return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);

    return null;
  }

  // GET /:website_id — recorded sessions, newest first.
  r.get("/:website_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const q = parseQuery(c, replayListQuerySchema);
    if (!q.ok) return q.res;

    const out = await recordings.listSessions(websiteRef, q.data.limit, q.data.offset);
    return c.json(out);
  });

  /**
   * DELETE /:website_id/batch
   *
   * Registered before `/:website_id/:session_id` so `batch` is not captured as a
   * session id. Hono matches in registration order, so this ordering is load-
   * bearing rather than stylistic.
   */
  r.delete("/:website_id/batch", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const parsed = await parseJson(c, replayBatchDeleteSchema);
    if (!parsed.ok) return parsed.res;

    try {
      await recordings.batchDelete(websiteRef, parsed.data.sessionIds);
    } catch (e) {
      // Deletion spans object storage and Postgres, so the failure modes are
      // varied and none are the caller's fault to fix. Log the detail, return a
      // generic message.
      recording_log.error({
        msg: "recording_delete_failed",
        website_id: websiteRef,
        err: e instanceof Error ? e.message : String(e),
      });
      return c.json({ error: "Failed to delete sessions" }, 500);
    }

    return c.json({ message: "sessions deleted" });
  });

  // GET /:website_id/:session_id — one recording with its event stream.
  r.get("/:website_id/:session_id", async (c) => {
    const websiteRef = c.req.param("website_id");
    const sessionId = c.req.param("session_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    try {
      const detail = await recordings.getSessionDetail(websiteRef, sessionId);
      // The service reports "not recorded yet" as a 404 result rather than
      // throwing, since it is a routine state the player renders differently.
      return c.json(detail.body, detail.status as ContentfulStatusCode);
    } catch (e) {
      recording_log.error({
        msg: "recording_load_failed",
        session_id: sessionId,
        website_id: websiteRef,
        err: e instanceof Error ? e.message : String(e),
      });
      return c.json({ error: "Failed to load replay" }, 500);
    }
  });

  return r;
}
