import type { Context } from "hono";
import { env, type AppConfig } from "../../../config";
import { takeRateToken } from "../../../platform/cache/token-bucket";
import { getClientIp } from "../../../platform/http/client-ip";
import { parseJson } from "../../../platform/validation";
import type { PortalLinks } from "../interfaces";
import { presentPortalSession } from "../lib/presenters";
import { portalTokenBodySchema } from "../validators/agency.schema";

/**
 * `POST /agency/portal/validate` — public: the portal link's token is the credential.
 *
 * Answers the client, its websites, the sections it may read and the agency's brand. The
 * data itself is read through the embed API (`/api/v1/embed/...`) with the same token as
 * `X-Embed-Token`, so a portal sees exactly what a client-scope embed link would.
 *
 * Every refusal — malformed, unknown, expired, revoked, suspended client, disabled owner —
 * is the same 401, so a caller learns nothing from which.
 */

export type PortalControllerDeps = {
  portal: PortalLinks;
  /** Read per request; the process config unless a test passes its own. */
  config?: () => Pick<AppConfig, "rateLimit" | "trustProxy" | "frontendUrl">;
};

/** Per client IP, on top of the general limiter: each attempt is a token guess. */
const VALIDATE_WINDOW_MS = 60_000;
const VALIDATE_MAX_PER_WINDOW = 20;

const invalidPortalToken = () =>
  ({ error: "This portal link is invalid or has expired.", code: "invalid_portal_token" }) as const;

export function validatePortalToken(deps: PortalControllerDeps) {
  return async (c: Context) => {
    const cfg = (deps.config ?? env)();
    c.header("Cache-Control", "no-store");
    if (cfg.rateLimit.enabled) {
      const r = takeRateToken(`agency:portal:${getClientIp(c, cfg.trustProxy)}`, VALIDATE_MAX_PER_WINDOW, VALIDATE_WINDOW_MS);
      if (!r.allowed) {
        c.header("Retry-After", String(Math.ceil(r.resetInMs / 1000)));
        return c.json({ error: "rate_limit_exceeded", message: "Too many requests. Try again later." }, 429);
      }
    }

    const parsed = await parseJson(c, portalTokenBodySchema);
    if (!parsed.ok) return parsed.res;
    const session = await deps.portal.open(parsed.data.token);
    if (!session) return c.json(invalidPortalToken(), 401);
    return c.json({ data: presentPortalSession(session, parsed.data.token, cfg.frontendUrl) });
  };
}
