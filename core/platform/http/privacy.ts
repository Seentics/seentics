import { Hono } from "hono";
import type { Context } from "hono";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";

/**
 * Data-subject endpoints — export, erasure, anonymisation.
 *
 * **Every handler here answers 501. None of them are implemented, and the point of this
 * file is to say so.**
 *
 * They previously returned success while doing nothing: `DELETE /delete/:user_id` gave
 * 204, `GET /export/:user_id` gave `{ data: [] }`. That is worse than an unimplemented
 * endpoint, because both answers are indistinguishable from a real one — an erasure
 * request reported as complete, and an export that reads as "we hold nothing about you".
 * Anyone integrating against them, or relying on them to answer a regulator, would have
 * been told the work happened.
 *
 * `/auth/forgot-password` in this same codebase returns 501 for the same reason, and that
 * is the pattern being matched. The routes stay registered so the paths remain reserved
 * and a caller gets a specific answer rather than a 404 they might read as a typo.
 *
 * Authentication is kept in front of them deliberately. When these are implemented, the
 * path parameter (`:user_id`, `:website_id`) will have to be checked against the caller
 * rather than trusted — `requireUser` only proves *someone* is signed in, and every
 * handler below takes an id from the URL. Doing that check is part of implementing them,
 * not something to bolt on afterwards.
 */

const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

/** One shape for every unimplemented handler, so no caller can read one as a success. */
function notImplemented(c: Context<{ Variables: AuthVars }>, capability: string) {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json(
    {
      error: `${capability} is not implemented`,
      code: "not_implemented",
      detail:
        "This endpoint is reserved and returns 501 until the capability is built. " +
        "It has never performed the action it names.",
    },
    501,
  );
}

r.get("/export/:user_id", (c) => notImplemented(c, "User data export"));
r.get("/export/website/:website_id", (c) => notImplemented(c, "Website data export"));
r.post("/import/:website_id", (c) => notImplemented(c, "Website data import"));
r.delete("/delete/:user_id", (c) => notImplemented(c, "User data erasure"));
r.delete("/delete/website/:website_id", (c) => notImplemented(c, "Website data erasure"));
r.put("/anonymize/:user_id", (c) => notImplemented(c, "User anonymisation"));
r.get("/retention-policies", (c) => notImplemented(c, "Retention policy listing"));
r.post("/cleanup", (c) => notImplemented(c, "On-demand retention cleanup"));

export const privacyRoutes = r;
