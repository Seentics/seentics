import { beforeEach, afterEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { SignJWT } from "jose";
import type { AppConfig } from "../../../config";
import { testConfig } from "../../../app/tests/helpers/test-config";
import { signAccessToken, signRefreshToken } from "../../lib/auth-jwt";
import type { AuthVars } from "../auth";
import { corsMiddleware } from "../cors";
import { rateLimitMiddleware } from "../rate-limit";
import { pruneRateBuckets } from "../../lib/token-bucket";

/**
 * The request-level security boundary: authentication, CORS and rate limiting.
 *
 * `platform/middleware/` had no tests at all, which is the wrong gap to have here —
 * every authenticated route in the product sits behind `authMiddleware`, and the two
 * others decide what a browser on someone else's page is allowed to do. The pieces they
 * are built from (`auth-jwt`, `client-ip`, `token-bucket`, `origin`) are each tested;
 * how they are wired together was not.
 *
 * Four properties are asserted below that no type expresses:
 *
 * - **The token comes from a header or a cookie, and nothing else.** A route that
 *   accepted a token from the query string would put credentials in access logs.
 * - **A refresh token must not authenticate a request.** The two are signed for
 *   different purposes; accepting either makes a stolen refresh token equivalent to a
 *   session.
 * - **Tracker CORS is `*` and deliberately without credentials.** Those endpoints are
 *   embedded on customer sites, so the origin cannot be restricted — which is exactly
 *   why `Access-Control-Allow-Credentials` must not be set on them.
 * - **Rate-limit tiers are chosen by path prefix.** `/api/v1/auth` gets the strict
 *   limit; a mis-ordered check would give the login endpoint the general one.
 *
 * No `mock.module` anywhere in this file: all three middlewares take their
 * configuration as a parameter, and `auth-jwt` reads the real `config`, so setting two
 * environment variables is enough. That matters — a global module mock here would apply
 * to every file in the run.
 *
 * The `?real` suffix on the `../auth` import is the load-bearing detail. Six route-test
 * files install `mock.module(".../platform/middleware/auth")` to stub authentication out
 * of their handlers, and Bun applies a module mock to the entire run — so a plain
 * `import { authMiddleware } from "../auth"` here yields *their stub*, and every
 * assertion below silently tests a fake that answers 401 unless an `X-Test-User` header
 * is present. That is why `analytics-cache-auth.test.ts` keeps a hand-written copy of
 * this middleware instead of importing it.
 *
 * A distinct specifier resolves to a separate registry entry, so `../auth?real` is the
 * real module regardless of what any other file mocked. This is the only way to exercise
 * the actual implementation rather than a copy of it.
 */

process.env.DATABASE_URL ??= "postgres://test-not-connected";
process.env.JWT_SECRET = "test-secret-value-that-is-long-enough-for-hs256";

/**
 * The real middleware, not the stub six route-test files install. See the note above.
 *
 * Held in a variable rather than written inline so TypeScript does not try to resolve
 * the suffixed specifier — it is a runtime instruction to Bun's module registry, not a
 * real path on disk.
 */
const REAL_AUTH_MODULE = "../auth?real";
const { authMiddleware, requireUser } = (await import(
  REAL_AUTH_MODULE
)) as typeof import("../auth");

const USER = "user-1";

/** A minimal app behind `authMiddleware`, echoing whatever the middleware established. */
function authedApp() {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use("*", authMiddleware);
  app.get("/me", (c) => c.json({ userId: requireUser(c) }));
  return app;
}

describe("authMiddleware", () => {
  describe("where it looks for the token", () => {
    it("accepts a Bearer header", async () => {
      const token = await signAccessToken(USER);

      const res = await authedApp().request("/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ userId: USER });
    });

    it("accepts an access_token cookie", async () => {
      const token = await signAccessToken(USER);

      const res = await authedApp().request("/me", {
        headers: { cookie: `access_token=${token}` },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ userId: USER });
    });

    it("picks the cookie out from among others", async () => {
      const token = await signAccessToken(USER);

      const res = await authedApp().request("/me", {
        headers: { cookie: `theme=dark; access_token=${token}; locale=en` },
      });

      expect(res.status).toBe(200);
    });

    it("url-decodes the cookie value", async () => {
      const token = await signAccessToken(USER);

      const res = await authedApp().request("/me", {
        headers: { cookie: `access_token=${encodeURIComponent(token)}` },
      });

      expect(res.status).toBe(200);
    });

    it("prefers the header over the cookie", async () => {
      // The header is the explicit choice; a stale cookie must not win over it.
      const headerToken = await signAccessToken("header-user");
      const cookieToken = await signAccessToken("cookie-user");

      const res = await authedApp().request("/me", {
        headers: {
          Authorization: `Bearer ${headerToken}`,
          cookie: `access_token=${cookieToken}`,
        },
      });

      expect(await res.json()).toEqual({ userId: "header-user" });
    });

    it("does not accept a token from the query string", async () => {
      // Credentials in a URL end up in access logs, browser history and referrers.
      const token = await signAccessToken(USER);

      const res = await authedApp().request(`/me?access_token=${token}`);

      expect(res.status).toBe(401);
    });

    it("does not accept a bare Authorization header without the scheme", async () => {
      const token = await signAccessToken(USER);

      const res = await authedApp().request("/me", {
        headers: { Authorization: token },
      });

      expect(res.status).toBe(401);
    });

    it("is case-sensitive about the Bearer scheme", async () => {
      const token = await signAccessToken(USER);

      const res = await authedApp().request("/me", {
        headers: { Authorization: `bearer ${token}` },
      });

      expect(res.status).toBe(401);
    });

    it("trims whitespace around the header token", async () => {
      const token = await signAccessToken(USER);

      const res = await authedApp().request("/me", {
        headers: { Authorization: `Bearer   ${token}  ` },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("what it rejects", () => {
    it("rejects a request with no credentials at all", async () => {
      const res = await authedApp().request("/me");

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Authorization required" });
    });

    it("distinguishes a missing token from an invalid one", async () => {
      // Different messages, because they mean different things to a client: one is
      // "sign in", the other is "your session ended".
      const missing = await authedApp().request("/me");
      const invalid = await authedApp().request("/me", {
        headers: { Authorization: "Bearer not-a-jwt" },
      });

      expect(await missing.json()).toEqual({ error: "Authorization required" });
      expect(await invalid.json()).toEqual({ error: "Invalid or expired token" });
    });

    it("rejects a malformed token", async () => {
      const res = await authedApp().request("/me", {
        headers: { Authorization: "Bearer aaa.bbb.ccc" },
      });

      expect(res.status).toBe(401);
    });

    it("rejects an empty Bearer value", async () => {
      const res = await authedApp().request("/me", {
        headers: { Authorization: "Bearer " },
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Authorization required" });
    });

    it("rejects an empty cookie value", async () => {
      const res = await authedApp().request("/me", {
        headers: { cookie: "access_token=" },
      });

      expect(res.status).toBe(401);
    });

    it("refuses a refresh token in place of an access token", async () => {
      // The two are signed for different purposes. Accepting either would make a
      // refresh token a session credential, defeating the point of short access tokens.
      const refresh = await signRefreshToken(USER);

      const res = await authedApp().request("/me", {
        headers: { Authorization: `Bearer ${refresh}` },
      });

      expect(res.status).toBe(401);
    });

    it("rejects a token signed with a different secret", async () => {
      // Forged with an explicit key rather than by swapping `process.env.JWT_SECRET`:
      // other test files install a global `config` mock, so the middleware reads its
      // secret from that stub and an environment swap here would be inert — the "forged"
      // token would come out correctly signed and the test would pass for the wrong
      // reason.
      const forged = await new SignJWT({ user_id: USER })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(new TextEncoder().encode("a-completely-different-secret-of-sufficient-length"));

      const res = await authedApp().request("/me", {
        headers: { Authorization: `Bearer ${forged}` },
      });

      expect(res.status).toBe(401);
    });

    it("does not reach the handler for a rejected request", async () => {
      let handlerRan = false;
      const app = new Hono<{ Variables: AuthVars }>();
      app.use("*", authMiddleware);
      app.get("/me", (c) => {
        handlerRan = true;
        return c.json({ ok: true });
      });

      await app.request("/me");

      expect(handlerRan).toBe(false);
    });

    it("answers 401, never 500, for a bad token", async () => {
      // A throw from `verifyAccessToken` that escaped the catch would turn every
      // expired session into a server error.
      const res = await authedApp().request("/me", {
        headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.!!!.!!!" },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("requireUser", () => {
    it("reports the id the middleware established", async () => {
      const token = await signAccessToken("some-user");

      const res = await authedApp().request("/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(await res.json()).toEqual({ userId: "some-user" });
    });

    it("reports null when nothing set a user", async () => {
      // The shape every route's guard branches on, exercised without the middleware.
      const app = new Hono<{ Variables: AuthVars }>();
      app.get("/me", (c) => c.json({ userId: requireUser(c) }));

      const res = await app.request("/me");

      expect(await res.json()).toEqual({ userId: null });
    });
  });
});

describe("corsMiddleware", () => {
  /** An app with CORS in front of one route, for the given allow-list. */
  function corsApp(allowed: string) {
    const app = new Hono();
    app.use("*", corsMiddleware(allowed));
    app.get("/api/v1/analytics/x", (c) => c.json({ ok: true }));
    app.get("/api/v1/tracker/collect", (c) => c.json({ ok: true }));
    app.post("/api/v1/tracker/collect", (c) => c.json({ ok: true }));
    return app;
  }

  const originalEnv = process.env.ENVIRONMENT;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = originalEnv;
  });

  describe("tracker endpoints", () => {
    it("allows any origin", async () => {
      // Embedded on customer sites, so the origin genuinely cannot be restricted.
      // Each handler validates the origin against the registered website URL instead.
      const res = await corsApp("https://app.seentics.com").request("/api/v1/tracker/collect", {
        headers: { Origin: "https://some-customer.example" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("does not allow credentials", async () => {
      // `*` plus credentials is the combination that turns a public endpoint into a
      // cross-origin read of an authenticated session. Tracker auth is API-key based,
      // so credentials are not needed at all.
      const res = await corsApp("https://app.seentics.com").request("/api/v1/tracker/collect", {
        headers: { Origin: "https://some-customer.example" },
      });

      expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    });

    it("answers a preflight with 204 and no body", async () => {
      const res = await corsApp("https://app.seentics.com").request("/api/v1/tracker/collect", {
        method: "OPTIONS",
        headers: { Origin: "https://some-customer.example" },
      });

      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
    });

    it("advertises the headers the tracker sends", async () => {
      const res = await corsApp("*").request("/api/v1/tracker/collect", {
        headers: { Origin: "https://x.example" },
      });

      const allowed = res.headers.get("Access-Control-Allow-Headers") ?? "";
      expect(allowed).toContain("X-API-Key");
      expect(allowed).toContain("Content-Type");
    });

    it("still runs the handler for a non-preflight request", async () => {
      const res = await corsApp("*").request("/api/v1/tracker/collect", {
        headers: { Origin: "https://x.example" },
      });

      expect(await res.json()).toEqual({ ok: true });
    });
  });

  describe("dashboard endpoints", () => {
    it("echoes an allow-listed origin and permits credentials", async () => {
      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "https://app.seentics.com" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.seentics.com");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("sets Vary: Origin when the response depends on it", async () => {
      // Without it a shared cache can serve one origin's allow header to another.
      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "https://app.seentics.com" },
      });

      expect(res.headers.get("Vary")).toBe("Origin");
    });

    it("does not echo an origin outside the allow-list", async () => {
      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "https://evil.example" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    });

    it("matches an allow-list entry exactly, not by prefix", async () => {
      // `https://app.seentics.com.evil.example` starts with the allowed value.
      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "https://app.seentics.com.evil.example" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("honours several allow-list entries", async () => {
      const app = corsApp("https://a.example, https://b.example");

      const b = await app.request("/api/v1/analytics/x", {
        headers: { Origin: "https://b.example" },
      });

      expect(b.headers.get("Access-Control-Allow-Origin")).toBe("https://b.example");
    });

    it("trims whitespace around allow-list entries", async () => {
      const res = await corsApp("  https://a.example ,  https://b.example  ").request(
        "/api/v1/analytics/x",
        { headers: { Origin: "https://a.example" } },
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://a.example");
    });

    it("allows localhost outside production, for local development", async () => {
      process.env.ENVIRONMENT = "development";

      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "http://localhost:3000" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    });

    it("refuses localhost in production", async () => {
      // Otherwise anyone running a page on their own machine can call a production API
      // with the user's cookies.
      process.env.ENVIRONMENT = "production";

      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "http://localhost:3000" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("refuses 127.0.0.1 in production too", async () => {
      process.env.ENVIRONMENT = "production";

      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "http://127.0.0.1:3000" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("treats a mixed-case ENVIRONMENT as production", async () => {
      process.env.ENVIRONMENT = "PRODUCTION";

      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "http://localhost:3000" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("does not treat a host merely containing localhost as local", async () => {
      process.env.ENVIRONMENT = "development";

      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "https://localhost.evil.example" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("allows every origin when the allow-list is a wildcard", async () => {
      const res = await corsApp("*").request("/api/v1/analytics/x", {
        headers: { Origin: "https://anything.example" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://anything.example");
    });

    it("falls back to * when there is no Origin and the list is a wildcard", async () => {
      const res = await corsApp("*").request("/api/v1/analytics/x");

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("sets no allow-origin for a request with no Origin and a real allow-list", async () => {
      // A same-origin or server-side call; there is nothing to grant.
      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x");

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("answers a preflight with 204", async () => {
      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        method: "OPTIONS",
        headers: { Origin: "https://app.seentics.com" },
      });

      expect(res.status).toBe(204);
    });

    it("still reaches the handler for an origin it did not allow", async () => {
      // CORS is enforced by the browser, not the server: the response is produced, it
      // just lacks the header that would let the page read it. Pinned because
      // "rejected origin" reads like a 403, and it is not.
      const res = await corsApp("https://app.seentics.com").request("/api/v1/analytics/x", {
        headers: { Origin: "https://evil.example" },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });
});

describe("rateLimitMiddleware", () => {
  /** A config with every tier limit set explicitly. */
  function limitConfig(over: Record<string, number | boolean> = {}): AppConfig {
    return testConfig({
      trustProxy: true,
      rateLimit: {
        enabled: true,
        windowMs: 60_000,
        generalMax: 100,
        authMax: 5,
        trackerMax: 1000,
        internalMax: 50,
        rawMax: 20,
        rawPerKeyMax: 0,
        ...over,
      },
    });
  }

  /** An app with the limiter in front of the paths whose tiers differ. */
  function limitedApp(cfg: AppConfig) {
    const app = new Hono();
    app.use("*", rateLimitMiddleware(cfg));
    for (const p of [
      "/health",
      "/api/v1/auth/login",
      "/api/v1/user/auth/login",
      "/api/v1/tracker/collect",
      "/api/v1/internal/x",
      "/api/v1/raw/x",
      "/api/v1/analytics/x",
    ]) {
      app.all(p, (c) => c.json({ ok: true }));
    }
    return app;
  }

  /** Distinct client IPs keep tests from sharing a bucket. */
  let ipCounter = 0;
  function nextIp(): string {
    ipCounter += 1;
    return `203.0.113.${ipCounter % 250}`;
  }

  beforeEach(() => {
    // The bucket store is module-level, so it survives between tests. A negative idle
    // threshold makes the existing sweep drop every bucket, which is enough — no
    // test-only export needed on the production module.
    pruneRateBuckets(-1);
    ipCounter += 7;
  });

  it("passes through when rate limiting is disabled", async () => {
    const app = limitedApp(limitConfig({ enabled: false }));
    const ip = nextIp();

    for (let i = 0; i < 20; i++) {
      const res = await app.request("/api/v1/auth/login", {
        headers: { "X-Forwarded-For": ip },
      });
      expect(res.status).toBe(200);
    }
  });

  it("sets no rate-limit headers when disabled", async () => {
    const res = await limitedApp(limitConfig({ enabled: false })).request("/api/v1/auth/login", {
      headers: { "X-Forwarded-For": nextIp() },
    });

    expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
  });

  it("reports the limit and what is left", async () => {
    const res = await limitedApp(limitConfig()).request("/api/v1/auth/login", {
      headers: { "X-Forwarded-For": nextIp() },
    });

    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
  });

  it("counts down as requests are spent", async () => {
    const app = limitedApp(limitConfig());
    const ip = nextIp();

    const first = await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });
    const second = await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });

    expect(first.headers.get("X-RateLimit-Remaining")).toBe("4");
    expect(second.headers.get("X-RateLimit-Remaining")).toBe("3");
  });

  it("refuses the request past the limit", async () => {
    const app = limitedApp(limitConfig());
    const ip = nextIp();

    for (let i = 0; i < 5; i++) {
      await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });
    }
    const res = await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "rate_limit_exceeded" });
  });

  it("says how long to wait", async () => {
    const app = limitedApp(limitConfig());
    const ip = nextIp();

    for (let i = 0; i < 5; i++) {
      await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });
    }
    const res = await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });

    const retry = Number(res.headers.get("Retry-After"));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60);
  });

  it("does not reach the handler once refused", async () => {
    let handled = 0;
    const app = new Hono();
    app.use("*", rateLimitMiddleware(limitConfig({ authMax: 1 })));
    app.all("/api/v1/auth/login", (c) => {
      handled += 1;
      return c.json({ ok: true });
    });
    const ip = nextIp();

    await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });
    await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });

    expect(handled).toBe(1);
  });

  it("buckets each client separately", async () => {
    const app = limitedApp(limitConfig({ authMax: 1 }));

    const a = await app.request("/api/v1/auth/login", {
      headers: { "X-Forwarded-For": nextIp() },
    });
    const b = await app.request("/api/v1/auth/login", {
      headers: { "X-Forwarded-For": nextIp() },
    });

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  describe("tiers", () => {
    it("skips /health entirely", async () => {
      // The health check has to answer even while a client is being throttled, or a
      // burst of traffic takes the instance out of its load balancer.
      const app = limitedApp(limitConfig({ generalMax: 1 }));
      const ip = nextIp();

      for (let i = 0; i < 10; i++) {
        const res = await app.request("/health", { headers: { "X-Forwarded-For": ip } });
        expect(res.status).toBe(200);
      }
    });

    it("sets no headers on a skipped path", async () => {
      const res = await limitedApp(limitConfig()).request("/health", {
        headers: { "X-Forwarded-For": nextIp() },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
    });

    it("gives /api/v1/auth the strict auth limit", async () => {
      const res = await limitedApp(limitConfig()).request("/api/v1/auth/login", {
        headers: { "X-Forwarded-For": nextIp() },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    });

    it("gives the session-scoped auth mount the same limit", async () => {
      // Both mounts of the credential trio have to be throttled, or the strict limit
      // is bypassable by using the other path.
      const res = await limitedApp(limitConfig()).request("/api/v1/user/auth/login", {
        headers: { "X-Forwarded-For": nextIp() },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    });

    it("gives the tracker its own high limit", async () => {
      const res = await limitedApp(limitConfig()).request("/api/v1/tracker/collect", {
        headers: { "X-Forwarded-For": nextIp() },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("1000");
    });

    it("gives internal routes their own limit", async () => {
      const res = await limitedApp(limitConfig()).request("/api/v1/internal/x", {
        headers: { "X-Forwarded-For": nextIp() },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("50");
    });

    it("gives the raw API its own limit", async () => {
      const res = await limitedApp(limitConfig()).request("/api/v1/raw/x", {
        headers: { "X-Forwarded-For": nextIp() },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("20");
    });

    it("falls back to the general limit for everything else", async () => {
      const res = await limitedApp(limitConfig()).request("/api/v1/analytics/x", {
        headers: { "X-Forwarded-For": nextIp() },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    });

    it("keeps the tiers in separate buckets", async () => {
      // Exhausting the auth tier must not throttle the dashboard, and vice versa.
      const app = limitedApp(limitConfig({ authMax: 1 }));
      const ip = nextIp();

      await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });
      const authAgain = await app.request("/api/v1/auth/login", {
        headers: { "X-Forwarded-For": ip },
      });
      const general = await app.request("/api/v1/analytics/x", {
        headers: { "X-Forwarded-For": ip },
      });

      expect(authAgain.status).toBe(429);
      expect(general.status).toBe(200);
    });
  });

  describe("preflight", () => {
    it("never throttles OPTIONS", async () => {
      // A throttled preflight fails the real request that follows it, and the browser
      // reports it as a CORS error rather than a rate limit — which is close to
      // undiagnosable from the client side.
      const app = limitedApp(limitConfig({ authMax: 1 }));
      const ip = nextIp();

      await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });

      for (let i = 0; i < 5; i++) {
        const res = await app.request("/api/v1/auth/login", {
          method: "OPTIONS",
          headers: { "X-Forwarded-For": ip },
        });
        expect(res.status).toBe(200);
      }
    });

    it("does not spend a token on OPTIONS", async () => {
      const app = limitedApp(limitConfig());
      const ip = nextIp();

      await app.request("/api/v1/auth/login", {
        method: "OPTIONS",
        headers: { "X-Forwarded-For": ip },
      });
      const res = await app.request("/api/v1/auth/login", { headers: { "X-Forwarded-For": ip } });

      expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    });
  });
});
