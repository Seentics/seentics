import { beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { Context } from "hono";
import type { AppConfig } from "../../../config";
import { analyticsCacheMiddleware } from "../middleware/analytics-cache";

/**
 * The read-through cache in front of the analytics router.
 *
 * Two properties carry the risk here. The first is that the key is derived from the
 * JWT *subject* rather than the raw header, so a token refresh does not cold-start the
 * cache — and, more importantly, so two different users can never share an entry. The
 * second is what must never be cached: exports, non-200s, and anything carrying a
 * Set-Cookie. Both are tested by observation through a real Hono app rather than by
 * reaching into the cache.
 */

function config(over: Partial<AppConfig["analyticsCache"]> = {}): AppConfig {
  return {
    analyticsCache: { enabled: true, ttlMs: 45_000, maxEntries: 512, ...over },
  } as AppConfig;
}

/** A base64url JWT carrying just the claims a key derivation would read. */
function jwt(claims: Record<string, unknown>, signature = "sig"): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64(claims)}.${signature}`;
}

describe("analyticsCacheMiddleware", () => {
  let hits: number;
  let app: Hono;

  /**
   * An app whose handler counts invocations, so a cache hit is observable as the
   * handler *not* running rather than as an assertion about cache internals.
   */
  function makeApp(
    cfg: AppConfig = config(),
    handler?: (c: Context) => Response | Promise<Response>,
  ) {
    hits = 0;
    const a = new Hono();
    a.use("*", analyticsCacheMiddleware(cfg));
    a.all("*", (c) => {
      hits++;
      return handler ? handler(c) : c.json({ served: hits });
    });
    return a;
  }

  beforeEach(() => {
    app = makeApp();
  });

  function get(path: string, auth?: string) {
    return app.request(path, { headers: auth ? { authorization: auth } : {} });
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

    it("ignores paths outside the analytics router", async () => {
      await get("/api/v1/websites/site_1");
      const second = await get("/api/v1/websites/site_1");
      expect(hits).toBe(2);
      expect(second.headers.get("X-Cache")).toBeNull();
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
      await get("/api/v1/analytics/dashboard/site_1", `Bearer ${jwt({ sub: "u1" })}`);
      await get("/api/v1/analytics/dashboard/site_1", `Bearer ${jwt({ sub: "u1" })}`);
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
      const a = `Bearer ${jwt({ sub: "user_a" })}`;
      const b = `Bearer ${jwt({ sub: "user_b" })}`;

      await get("/api/v1/analytics/dashboard/site_1", a);
      const second = await get("/api/v1/analytics/dashboard/site_1", b);

      expect(hits).toBe(2);
      expect(second.headers.get("X-Cache")).toBe("MISS");
    });

    it("survives a token refresh — same subject, different signature", async () => {
      // This is why the key uses the decoded subject rather than the header: a client
      // that refreshes its JWT every few minutes would otherwise never hit the cache.
      const before = `Bearer ${jwt({ sub: "user_a" }, "signature-one")}`;
      const after = `Bearer ${jwt({ sub: "user_a", iat: 999 }, "signature-two")}`;

      await get("/api/v1/analytics/dashboard/site_1", before);
      const second = await get("/api/v1/analytics/dashboard/site_1", after);

      expect(second.headers.get("X-Cache")).toBe("HIT");
      expect(hits).toBe(1);
    });

    it("falls back to alternate identity claims", async () => {
      for (const claims of [{ user_id: "u9" }, { id: "u9" }]) {
        app = makeApp();
        const token = `Bearer ${jwt(claims, "sig-a")}`;
        const refreshed = `Bearer ${jwt(claims, "sig-b")}`;
        await get("/api/v1/analytics/dashboard/site_1", token);
        expect((await get("/api/v1/analytics/dashboard/site_1", refreshed)).headers.get("X-Cache")).toBe(
          "HIT",
        );
      }
    });

    it("keys on the whole header when the token is not a decodable JWT", async () => {
      // Degrading to the raw value keeps two different opaque tokens apart, which is
      // the safe direction to fail in.
      await get("/api/v1/analytics/dashboard/site_1", "Bearer opaque-token-one");
      const other = await get("/api/v1/analytics/dashboard/site_1", "Bearer opaque-token-two");
      expect(hits).toBe(2);
      expect(other.headers.get("X-Cache")).toBe("MISS");
    });

    it("does not let an anonymous request read an authenticated entry", async () => {
      await get("/api/v1/analytics/public/dashboard/share_1", `Bearer ${jwt({ sub: "u1" })}`);
      const anon = await get("/api/v1/analytics/public/dashboard/share_1");
      expect(anon.headers.get("X-Cache")).toBe("MISS");
      expect(hits).toBe(2);
    });

    it("accepts a lower-case bearer prefix", async () => {
      const token = jwt({ sub: "u1" });
      await get("/api/v1/analytics/dashboard/site_1", `bearer ${token}`);
      expect(
        (await get("/api/v1/analytics/dashboard/site_1", `Bearer ${token}`)).headers.get("X-Cache"),
      ).toBe("HIT");
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
