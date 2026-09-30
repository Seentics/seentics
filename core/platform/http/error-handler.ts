import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { log as baseLog } from "../observability/logger";

const log = baseLog.child({ category: "http" });

/**
 * Postgres codes that mean "the identifier in the request is not a valid value", not
 * "the server failed": a website or record id that is not a UUID reaching a uuid column.
 * 22P02 invalid_text_representation, 22007 invalid_datetime_format.
 */
const BAD_INPUT_CODES = new Set(["22P02", "22007"]);

/**
 * The app-wide error handler.
 *
 * There was none, so every uncaught error became Hono's plain-text 500 — including a
 * malformed id in the URL, which reached Postgres as an invalid UUID. A client asking
 * for a resource that cannot exist gets a 404, a deliberate HTTP error keeps its
 * status, and only a genuine failure is a 500 (logged, with a JSON body like the rest
 * of the API).
 */
export function handleAppError(err: Error, c: Context): Response {
  if (err instanceof HTTPException) return err.getResponse();
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && BAD_INPUT_CODES.has(code)) {
    return c.json({ error: "not found" }, 404);
  }
  log.error({ msg: "unhandled_error", method: c.req.method, path: c.req.path, error: err.message, stack: err.stack });
  return c.json({ error: "internal server error" }, 500);
}
