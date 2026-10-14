import type { Context } from "hono";
import { log } from "../../../platform/observability/logger";
import type { AuthVars } from "../../../platform/middleware/auth";
import { parseQuery } from "../../../platform/validation";
import { replayAnalysisQuerySchema } from "../validators/recording.schema";
import { requireRecordingAccess } from "./recording-access";
import type { RecordingControllerDeps } from "./recording-controller.types";

const recordingLog = log.child({ category: "recordings" });

/**
 * GET /:website_id/:session_id/analysis — frustration signals and the summary.
 *
 * Reading may write: a session the analysis job has not reached is analysed now, and a
 * summary is written if there is none — once per session, behind a cooldown and the site's
 * daily allowance (see `SessionAnalysisService`). `?summarize=0` asks for the signals only.
 */
export function getRecordingAnalysis(deps: RecordingControllerDeps) {
  return async (c: Context<{ Variables: AuthVars }, "/:website_id/:session_id/analysis">) => {
    const websiteRef = c.req.param("website_id");
    const access = await requireRecordingAccess(c, deps, websiteRef);
    if ("denied" in access) return access.denied;
    const query = parseQuery(c, replayAnalysisQuerySchema);
    if (!query.ok) return query.res;
    const sessionId = c.req.param("session_id");
    try {
      const view = await deps.recordingAnalysis.getAnalysis(websiteRef, sessionId, { summarize: query.data.summarize });
      if (view.status === "not_found") return c.json({ error: "session not found" }, 404);
      if (view.retryAfterSec) c.header("Retry-After", String(view.retryAfterSec));
      return c.json({ data: view });
    } catch (error) {
      recordingLog.error({
        msg: "recording_analysis_failed",
        session_id: sessionId,
        website_id: websiteRef,
        err: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: "Failed to analyse session" }, 500);
    }
  };
}
