import { randomUUID } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { env, type AppConfig } from "../../../config";
import { isGlobalApiKeyValid } from "../../../platform/security/global-key";
import { fail } from "./envelope";

/**
 * Who is calling the agency API, as the gateway says.
 *
 * Core does not authenticate agency callers itself. The gateway does — a session or an
 * account API key, its scopes, the Agency plan — and forwards the request with:
 *
 *   X-Agency-Owner  the agency's account (owner) user id; all data is scoped to it
 *   X-Agency-Actor  who acted: a user id, or `key:<id>` for an account API key
 *   X-Agency-Pool   the plan's included amounts, `events=<n>,recordings=<n>,leads=<n>,ai_analyses=<n>`
 *
 * Those headers are trusted only when the request also carries the gateway's own key
 * (`X-API-Key` = `GLOBAL_API_KEY`), whatever `gatewayOnly` says: without it anyone who can
 * reach Core could name any agency. A self-hosted Core without a global key therefore
 * answers every agency request 401 — the workspace needs the gateway.
 */
export type AgencyCaller = {
  ownerId: string;
  actor: string;
  /** Empty when the gateway sent none; caps (phase 4) validate against it. */
  pool: Partial<Record<PoolResource, number>>;
};

export const POOL_RESOURCES = ["events", "recordings", "leads", "ai_analyses"] as const;
export type PoolResource = (typeof POOL_RESOURCES)[number];

export type AgencyVars = { agency: AgencyCaller; requestId: string };
export type AgencyCtx = Context<{ Variables: AgencyVars }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A user id, or an account key's id behind `key:`. */
const ACTOR_RE = /^(key:)?[0-9a-zA-Z-]{1,64}$/;

/** `events=1000,recordings=50` → `{ events: 1000, recordings: 50 }`; unknown or malformed pairs are dropped. */
export function parsePool(header: string | undefined): AgencyCaller["pool"] {
  const pool: AgencyCaller["pool"] = {};
  for (const pair of (header ?? "").split(",")) {
    const [key, value] = pair.split("=").map((s) => s.trim());
    if (!key || !(POOL_RESOURCES as readonly string[]).includes(key) || !/^\d+$/.test(value ?? "")) continue;
    pool[key as PoolResource] = Number(value);
  }
  return pool;
}

/** The request id: the gateway's `X-Request-ID` when it sent one, else a fresh one. */
function requestIdOf(c: Context): string {
  const sent = c.req.header("X-Request-ID")?.trim();
  return sent && sent.length <= 128 ? sent : randomUUID();
}

export function gatewayContext(config: () => Pick<AppConfig, "globalApiKey"> = env): MiddlewareHandler<{ Variables: AgencyVars }> {
  return async (c, next) => {
    const requestId = requestIdOf(c);
    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);
    c.header("Cache-Control", "no-store");

    if (!isGlobalApiKeyValid(config() as AppConfig, c.req.header("X-API-Key"))) {
      return fail(c, 401, "unauthorized", "Agency API requests must come through the gateway.");
    }
    const ownerId = c.req.header("X-Agency-Owner")?.trim() ?? "";
    if (!UUID_RE.test(ownerId)) return fail(c, 401, "unauthorized", "No agency named for this request.");
    const actor = c.req.header("X-Agency-Actor")?.trim() || ownerId;
    if (!ACTOR_RE.test(actor)) return fail(c, 401, "unauthorized", "Unrecognised agency actor.");

    c.set("agency", { ownerId: ownerId.toLowerCase(), actor, pool: parsePool(c.req.header("X-Agency-Pool")) });
    return next();
  };
}
