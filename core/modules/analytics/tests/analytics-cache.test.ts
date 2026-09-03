import { beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { Context } from "hono";
import type { AuthVars } from "../../../platform/middleware/auth";
import type { AppConfig } from "../../../config";
import { analyticsCacheMiddleware, PUBLIC_IDENTITY } from "../middleware/analytics-cache";

/**
 * The read-through cache in front of the analytics router.
 *
 * Identity now arrives through `identify`, and the caller is responsible for passing
 * something already authenticated. An earlier version derived it here by base64-decoding
 * the JWT payload without checking the signature, which — combined with the cache being
 * mounted globally, ahead of `authMiddleware` — meant a forged `alg: none` token carrying
 * a victim's id was served the victim's cached response. The tests for that behaviour
 * described it as a feature ("survives a token refresh"), so they are gone with it.
 * `analytics-cache-auth.test.ts` covers the ordering end to end.
 *
 * What remains risky and is tested here: two identities must never share an entry, a
 * request with no identity must not be cached at all, and exports, non-200s and
 * Set-Cookie responses must never be stored. All observed through a real Hono app rather
 * than by reaching into the cache.
 */

function config(over: Partial<AppConfig["analyticsCache"]> = {}): AppConfig {
  return {
    analyticsCache: { enabled: true, ttlMs: 45_000, maxEntries: 512, ...over },
  } as AppConfig;
}

/**
 * Stands in for `authMiddleware`: sets a *verified* user on the context.
 *
 * The header is trusted here because this file tests the cache, not authentication —
 * in the real router the value comes from `verifyAccessToken`.
 */
function withUser(a: Hono<{ Variables: AuthVars }>) {
  a.use("*", async (c, next) => {
    const u = c.req.header("x-test-user");
    if (u) c.set("userId", u);
    await next();
  });
}

describe("analyticsCacheMiddleware", () => {
  let hits: number;
  let app: Hono<{ Variables: AuthVars }>;

  /**
   * An app whose handler counts invocations, so a cache hit is observable as the
   * handler *not* running rather than as an assertion about cache internals.
   */
  function makeApp(
    cfg: AppConfig = config(),
    handler?: (c: Context) => Response | Promise<Response>,
  ) {
    hits = 0;
    const a = new Hono<{ Variables: AuthVars }>();
    withUser(a);
    a.use("*", analyticsCacheMiddleware(cfg, (c) => c.get("userId") ?? null));
    a.all("*", (c) => {
      hits++;
      return handler ? handler(c) : c.json({ served: hits });
    });
    return a;
  }

  beforeEach(() => {
    app = makeApp();
  });

  /**
   * `user` is the identity `authMiddleware` would have resolved.
   *
   * Defaulted, because almost every test here is about *what* gets cached rather than
   * for whom, and an unidentified request is now deliberately never cached — see the
   * "no resolved identity" block. Use `getAnonymous` to exercise that path.
   */
  function get(path: string, user = "default_user") {
    return app.request(path, { headers: { "x-test-user": user } });
  }

  /** A request that reached the cache without a resolved user. */
  function getAnonymous(path: string) {
    return app.request(path, { headers: {} });
  }

  // ─── What gets cached ─────────────────────────────────────────────────────

  describe("gating", () => {
    it("serves the second identical request from the cache", async () => {
      const first = await get("/api/v1/analytics/dashboard/site_1?days=7");
      const second = await get("/api/v1/analytics/dashboard/site_1?days=7");

      expect(first.headers.get("X-Cache")).toBe("MISS");
      expect(second.headers.get("X-Cache")).toBe("HIT");
      expect(hits).toBe(1);
      expect(await second.json()).toEqual({ served: 1 });
    });

    it("does nothing when the cache is disabled", async () => {
      app = makeApp(config({ enabled: false }));
      await get("/api/v1/analytics/dashboard/site_1");
      const second = await get("/api/v1/analytics/dashboard/site_1");

      expect(hits).toBe(2);
      expect(second.headers.get("X-Cache")).toBeNull();
    });

    it("never caches a non-GET request", async () => {
      const post = () =>
        app.request("/api/v1/analytics/import", {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json" },
        });
      await post();
      await post();
      expect(hits).toBe(2);
    });

    /**
     * Scope is the mount point now, not a string check.
     *
     * The middleware used to test for an `/api/v1/analytics` prefix because it was
     * mounted globally in `index.ts` and saw every request in the process. Mounting it
     * inside the analytics router is what fixed the auth-ordering bug, and it also means
     * a path outside that router never reaches this code at all.
     */
    it("caches whatever the router it is mounted in receives", async () => {
      await get("/api/v1/analytics/anything");
      const second = await get("/api/v1/analytics/anything");
      expect(hits).toBe(1);
      expect(second.headers.get("X-Cache")).toBe("HIT");
    });

    it("never caches an export — the payload is large and one-shot", async () => {
      await get("/api/v1/analytics/export/site_1");
      const second = await get("/api/v1/analytics/export/site_1");
      expect(hits).toBe(2);
      expect(second.headers.get("X-Cache")).toBeNull();
    });

    it("caches every other analytics read", async () => {
      for (const path of [
        "dashboard",
        "realtime",
        "top-pages",
        "revenue",
        "recent-activity",
        "public/dashboard",
      ]) {
        app = makeApp();
        await get(`/api/v1/analytics/${path}/site_1`);
        const second = await get(`/api/v1/analytics/${path}/site_1`);
        expect(second.headers.get("X-Cache")).toBe("HIT");
      }
    });
  });

  // ─── What must not be cached ──────────────────────────────────────────────

  describe("response filtering", () => {
    it("does not cache a non-200 response", async () => {
      // Caching a 500 would pin an outage in place for the whole TTL.
      app = makeApp(config(), (c) => c.json({ error: "boom" }, 500));
      await get("/api/v1/analytics/dashboard/site_1");
      await get("/api/v1/analytics/dashboard/site_1");
      expect(hits).toBe(2);
    });

    it("does not cache a 403", async () => {
      app = makeApp(config(), (c) => c.json({ error: "forbidden" }, 403));
      await get("/api/v1/analytics/dashboard/site_1", "u1");
      await get("/api/v1/analytics/dashboard/site_1", "u1");
      expect(hits).toBe(2);
    });

    it("does not cache a non-JSON response", async () => {
      app = makeApp(config(), () => new Response("plain", { headers: { "content-type": "text/plain" } }));
      await get("/api/v1/analytics/dashboard/site_1");
      await get("/api/v1/analytics/dashboard/site_1");
      expect(hits).toBe(2);
    });

    it("strips Set-Cookie from what it stores and replays", async () => {
      // A cached Set-Cookie would hand one user's session to the next reader of the
      // entry — the single worst failure mode available to a shared response cache.
      app = makeApp(config(), (c) => {
        c.header("set-cookie", "session=secret; HttpOnly");
        return c.json({ served: hits });
      });
      await get("/api/v1/analytics/dashboard/site_1");
      const second = await get("/api/v1/analytics/dashboard/site_1");

      expect(second.headers.get("X-Cache")).toBe("HIT");
      expect(second.headers.get("set-cookie")).toBeNull();
    });

    it("does not replay a stale X-Cache header from the stored entry", async () => {
      await get("/api/v1/analytics/dashboard/site_1");
      const second = await get("/api/v1/analytics/dashboard/site_1");
      const third = await get("/api/v1/analytics/dashboard/site_1");
      expect(second.headers.get("X-Cache")).toBe("HIT");
      expect(third.headers.get("X-Cache")).toBe("HIT");
    });
  });

  // ─── Key derivation ───────────────────────────────────────────────────────

  describe("cache key", () => {
    it("separates entries by path", async () => {
      await get("/api/v1/analytics/dashboard/site_1");
      await get("/api/v1/analytics/dashboard/site_2");
      expect(hits).toBe(2);
    });

    it("separates entries by query string", async () => {
      // Two windows are two different reports; sharing a key would show a 7-day
      // dashboard to someone who asked for 30.
      await get("/api/v1/analytics/dashboard/site_1?days=7");
      const other = await get("/api/v1/analytics/dashboard/site_1?days=30");
      expect(hits).toBe(2);
      expect(other.headers.get("X-Cache")).toBe("MISS");
    });

    it("never shares an entry between two users", async () => {
      await get("/api/v1/analytics/dashboard/site_1", "user_a");
      const second = await get("/api/v1/analytics/dashboard/site_1", "user_b");

      expect(hits).toBe(2);
      expect(second.headers.get("X-Cache")).toBe("MISS");
    });

    it("hits for the same user regardless of which token they presented", async () => {
      // The key is the resolved user, not the credential, so a client that refreshes
      // its JWT every few minutes still hits the cache. That was the original goal of
      // decoding the token here; taking the id from `authMiddleware` gets it without
      // parsing anything unverified.
      await get("/api/v1/analytics/dashboard/site_1", "user_a");
      const second = await get("/api/v1/analytics/dashboard/site_1", "user_a");

      expect(second.headers.get("X-Cache")).toBe("HIT");
      expect(hits).toBe(1);
    });

    describe("a request with no resolved identity", () => {
      /**
       * Fail closed. Serving a cached body to a request that never proved who it is
       * repeats the original bug, and storing one under a shared placeholder key would
       * pool unrelated callers into a single entry.
       */
      it("is never served from the cache", async () => {
        await get("/api/v1/analytics/dashboard/site_1", "user_a");
        const anon = await getAnonymous("/api/v1/analytics/dashboard/site_1");

        expect(anon.headers.get("X-Cache")).toBeNull();
        expect(hits).toBe(2);
      });

      it("is never stored in the cache", async () => {
        await getAnonymous("/api/v1/analytics/dashboard/site_1");
        const again = await getAnonymous("/api/v1/analytics/dashboard/site_1");

        expect(again.headers.get("X-Cache")).toBeNull();
        expect(hits).toBe(2);
      });
    });

    it("gives the public scope one entry shared by every holder of the link", async () => {
      // `PUBLIC_IDENTITY` is a constant: a share link has no viewer, and the response
      // is the same for everyone who opens it.
      const a = new Hono();
      let served = 0;
      a.use("*", analyticsCacheMiddleware(config(), PUBLIC_IDENTITY));
      a.all("*", (c) => c.json({ served: ++served }));

      await a.request("/api/v1/analytics/public/dashboard/share_1");
      const second = await a.request("/api/v1/analytics/public/dashboard/share_1");

      expect(second.headers.get("X-Cache")).toBe("HIT");
      expect(served).toBe(1);
    });
  });

  // ─── Expiry and body fidelity ─────────────────────────────────────────────

  describe("stored payload", () => {
    it("replays the body byte-for-byte", async () => {
      const payload = {
        website_id: "site_1",
        metrics: { pages_per_session: 2.5, bounce_rate: 42.5 },
        rows: [{ page: "/a", views: 1 }],
        nulls: null,
      };
      app = makeApp(config(), (c) => c.json(payload));

      await get("/api/v1/analytics/dashboard/site_1");
      const second = await get("/api/v1/analytics/dashboard/site_1");
      expect(await second.json()).toEqual(payload);
    });

    it("serves a fresh response once the entry expires", async () => {
      app = makeApp(config({ ttlMs: 1 }));
      await get("/api/v1/analytics/dashboard/site_1");
      await new Promise((r) => setTimeout(r, 20));
      const second = await get("/api/v1/analytics/dashboard/site_1");

      expect(second.headers.get("X-Cache")).toBe("MISS");
      expect(hits).toBe(2);
    });

    it("evicts under pressure rather than growing without bound", async () => {
      // maxEntries has a floor of 16 in MemoryCache, so overflow it well past that.
      app = makeApp(config({ maxEntries: 16 }));
      for (let i = 0; i < 40; i++) await get(`/api/v1/analytics/dashboard/site_${i}`);
      const evicted = await get("/api/v1/analytics/dashboard/site_0");
      expect(evicted.headers.get("X-Cache")).toBe("MISS");
    });

    it("keeps a recently-read entry alive across eviction pressure", async () => {
      app = makeApp(config({ maxEntries: 16 }));
      await get("/api/v1/analytics/dashboard/keep");
      for (let i = 0; i < 10; i++) {
        await get("/api/v1/analytics/dashboard/keep");
        await get(`/api/v1/analytics/dashboard/site_${i}`);
      }
      expect((await get("/api/v1/analytics/dashboard/keep")).headers.get("X-Cache")).toBe("HIT");
    });
  });
});
