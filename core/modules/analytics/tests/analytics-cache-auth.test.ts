import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { Context, Next } from "hono";

process.env.DATABASE_URL ??= "postgres://test-not-connected";
process.env.JWT_SECRET = "test-secret-value-that-is-long-enough-for-hs256";

import { analyticsCacheMiddleware } from "../middleware/analytics-cache";
import type { AuthVars } from "../../../platform/middleware/auth";
import { signAccessToken, verifyAccessToken } from "../../../platform/lib/auth-jwt";
import { testConfig } from "../../../app/tests/helpers/test-config";

/**
 * The cache must never answer a request that authentication would have refused.
 *
 * This is a regression test for a real bypass. The cache was mounted globally in
 * `index.ts` while `authMiddleware` lived inside the analytics router, so the cache ran
 * *first* — and a cache hit returns without calling `next()`, skipping authentication
 * entirely. The key was derived by base64-decoding the JWT payload without verifying the
 * signature, so an unsigned `alg: none` token carrying a victim's user id produced the
 * victim's key and was served the victim's data with a 200.
 *
 * Two things fixed it and both are asserted below: the cache is mounted *after*
 * `authMiddleware`, and its key comes from the `userId` that middleware resolved through
 * `verifyAccessToken`.
 *
 * The ordering is what matters, so this test wires a router the same way the real one
 * does rather than calling the middleware directly. A unit test of the cache alone
 * cannot see this class of bug — the previous suite had thorough cache-key tests and
 * described the vulnerable behaviour as a feature.
 *
 * `authenticate` below is a local copy of `authMiddleware` rather than an import of it,
 * for a mechanical reason: `analytics-routes.test.ts` installs a global
 * `mock.module("platform/middleware/auth")` that stubs authentication out, and Bun
 * applies module mocks to the whole run — importing the real one here yields the stub
 * whenever that file loads first. The copy calls the same `verifyAccessToken`, which is
 * where the actual signature check lives and which `platform/lib/tests/auth-jwt.test.ts`
 * covers directly. What this file pins is the *ordering* and the *keying*.
 */

const cfg = testConfig({
  analyticsCache: { enabled: true, ttlMs: 45_000, maxEntries: 512 },
});

const VICTIM = "victim-user-id";
const ATTACKER = "attacker-user-id";

/** The same check `authMiddleware` performs — see the note above on why it is copied. */
async function authenticate(c: Context<{ Variables: AuthVars }>, next: Next) {
  const auth = c.req.header("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return c.json({ error: "Authorization required" }, 401);
  try {
    const { userId } = await verifyAccessToken(token);
    c.set("userId", userId);
    return next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

/** Mirrors `createAnalyticsRoutes`: auth first, then the cache, then the handlers. */
function buildApp() {
  const app = new Hono();
  const r = new Hono<{ Variables: AuthVars }>();

  r.use("*", authenticate);
  r.use("*", analyticsCacheMiddleware(cfg, (c) => c.get("userId") ?? null));
  r.get("/dashboard/:website_id", (c) =>
    c.json({ owner: c.get("userId"), revenue: 999 }),
  );

  app.route("/api/v1/analytics", r);
  return app;
}

/** An unsigned token claiming to be someone else — the original exploit. */
function forgedToken(userId: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ user_id: userId, sub: userId })}.`;
}

function get(app: Hono, token: string) {
  return app.request("/api/v1/analytics/dashboard/site_1", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("the analytics cache cannot be used to bypass authentication", () => {
  it("warms the cache for a legitimately authenticated user", async () => {
    const app = buildApp();
    const token = await signAccessToken(VICTIM);

    const first = await get(app, token);
    const second = await get(app, token);

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ owner: VICTIM, revenue: 999 });
    // Warm, so the assertions below are about a populated cache rather than an empty one.
    expect(second.headers.get("X-Cache")).toBe("HIT");
  });

  it("refuses a forged token even when the victim's entry is cached", async () => {
    const app = buildApp();
    await get(app, await signAccessToken(VICTIM));

    const attack = await get(app, forgedToken(VICTIM));

    expect(attack.status).toBe(401);
    expect(attack.headers.get("X-Cache")).toBeNull();
    expect(await attack.text()).not.toContain("revenue");
  });

  it("refuses a token signed with the wrong key", async () => {
    const app = buildApp();
    await get(app, await signAccessToken(VICTIM));

    // Structurally valid, correct claims, wrong signature.
    const { SignJWT } = await import("jose");
    const forged = await new SignJWT({ user_id: VICTIM })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("a-different-secret-entirely-not-the-real-one"));

    expect((await get(app, forged)).status).toBe(401);
  });

  it("does not serve one authenticated user the other's cached entry", async () => {
    const app = buildApp();
    await get(app, await signAccessToken(VICTIM));

    const other = await get(app, await signAccessToken(ATTACKER));

    expect(other.status).toBe(200);
    expect(await other.json()).toEqual({ owner: ATTACKER, revenue: 999 });
    expect(other.headers.get("X-Cache")).toBe("MISS");
  });

  it("refuses a request with no token at all", async () => {
    const app = buildApp();
    await get(app, await signAccessToken(VICTIM));

    const anon = await app.request("/api/v1/analytics/dashboard/site_1");
    expect(anon.status).toBe(401);
  });
});
