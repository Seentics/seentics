import { beforeAll, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { fakeDbModule, fakeLogger } from "../../../app/tests/helpers/fake-db";
import { API_BASE_PATH, API_CATALOGUE } from "../api-catalogue";
import { API_SCOPES } from "../keys/scopes";

/**
 * The public API reference, checked against the router that serves it.
 *
 * The reference is what a developer builds against, and hand-written docs drift the
 * moment an endpoint is added or renamed. Comparing the catalogue to the router's own
 * route table turns that drift into a failing test instead of a support question.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

// The auth middleware reads rate-limit config on every request; without it the 401 path
// throws before it can answer, which would make an auth test look like a server error.
mock.module("../../../config", () => ({
  env: () => ({ rateLimit: { enabled: false, rawPerKeyMax: 0, windowMs: 60_000 } }),
}));

let createRawDataRoutes: typeof import("../routes").createRawDataRoutes;
// Loaded here rather than imported at the top: a static import is hoisted above the
// `mock.module` calls, so the real config module would load and demand a DATABASE_URL.
let requireScope: typeof import("../../middleware/raw-api-auth").requireScope;

/** Enough of the analytics surface for the factory to register its routes. */
function stubAnalytics(): never {
  return new Proxy({}, { get: () => async () => ({}) }) as never;
}

beforeAll(async () => {
  ({ createRawDataRoutes } = await import("../routes"));
  ({ requireScope } = await import("../../middleware/raw-api-auth"));
});

/** Every GET the router registers, minus the catalogue endpoint itself. */
function registeredPaths(): Set<string> {
  const routes = createRawDataRoutes({
    analytics: stubAnalytics(),
    ports: {} as never,
  }).routes;

  return new Set(
    routes
      .filter((r) => r.method === "GET" && r.path !== "/v1/catalogue")
      .map((r) => r.path),
  );
}

describe("API catalogue", () => {
  it("documents every endpoint the router serves", () => {
    // An endpoint nobody documented is one nobody can use.
    const documented = new Set(API_CATALOGUE.map((e) => e.path));
    const undocumented = [...registeredPaths()].filter((p) => !documented.has(p));
    expect(undocumented).toEqual([]);
  });

  it("documents nothing the router does not serve", () => {
    // The other direction: a reference promising an endpoint that 404s is worse than
    // one that is merely incomplete.
    const registered = registeredPaths();
    const phantom = API_CATALOGUE.map((e) => e.path).filter((p) => !registered.has(p));
    expect(phantom).toEqual([]);
  });

  it("has no duplicate entries", () => {
    const paths = API_CATALOGUE.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every endpoint a scope the key form can actually grant", () => {
    // A scope no key can carry would make the endpoint permanently unreachable.
    for (const endpoint of API_CATALOGUE) {
      expect(API_SCOPES).toContain(endpoint.scope);
    }
  });

  it("gives every endpoint a summary written for a caller", () => {
    for (const endpoint of API_CATALOGUE) {
      expect(endpoint.summary.length).toBeGreaterThan(10);
      expect(endpoint.summary.endsWith(".")).toBe(true);
    }
  });

  it("names every parameter it documents", () => {
    for (const endpoint of API_CATALOGUE) {
      for (const param of endpoint.params) {
        expect(param.name).toMatch(/^[a-z_]+$/);
        expect(param.description.length).toBeGreaterThan(5);
      }
    }
  });

  it("has no duplicate parameters within an endpoint", () => {
    for (const endpoint of API_CATALOGUE) {
      const names = endpoint.params.map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("groups every endpoint under a heading the reference can render", () => {
    const groups = new Set(API_CATALOGUE.map((e) => e.group));
    expect(groups.size).toBeGreaterThan(1);
    for (const endpoint of API_CATALOGUE) {
      expect(endpoint.group.length).toBeGreaterThan(0);
    }
  });

  it("scopes replay and heatmap endpoints away from analytics", () => {
    // The reason scopes exist: a key for building a traffic dashboard has no business
    // reading session recordings.
    const byPath = new Map(API_CATALOGUE.map((e) => [e.path, e]));
    expect(byPath.get("/v1/websites/:website_id/sessions")?.scope).toBe("replays:read");
    expect(byPath.get("/v1/websites/:website_id/heatmap/points")?.scope).toBe("heatmaps:read");
    expect(byPath.get("/v1/websites/:website_id/analytics/top-pages")?.scope).toBe("analytics:read");
  });

  it("states the base path callers prepend", () => {
    expect(API_BASE_PATH).toBe("/api/v1/raw");
    for (const endpoint of API_CATALOGUE) {
      expect(endpoint.path.startsWith("/v1/websites/:website_id")).toBe(true);
    }
  });
});

describe("GET /v1/catalogue", () => {
  function app() {
    return createRawDataRoutes({ analytics: stubAnalytics(), ports: {} as never });
  }

  it("is readable without an API key", async () => {
    // Requiring a key to discover what the key is for would be a loop.
    const res = await app().request("/v1/catalogue");
    expect(res.status).toBe(200);
  });

  it("returns the catalogue with the base path and auth header named", async () => {
    const res = await app().request("/v1/catalogue");
    const body = (await res.json()) as {
      meta: { base_path: string; auth: string; count: number };
      data: unknown[];
    };

    expect(body.meta.base_path).toBe(API_BASE_PATH);
    expect(body.meta.auth).toBe("X-API-Key");
    expect(body.meta.count).toBe(API_CATALOGUE.length);
    expect(body.data).toHaveLength(API_CATALOGUE.length);
  });

  it("still requires a key for every data endpoint", async () => {
    // The catalogue being public must not have opened anything else.
    const res = await app().request("/v1/websites/site_1/analytics/top-pages");
    expect(res.status).toBe(401);
  });

});

describe("requireScope", () => {
  /** A route guarded by one scope, with the key context already established. */
  function guarded(scopes: string[] | null) {
    const app = new Hono();
    app.use("*", async (c, next) => {
      if (scopes !== null) {
        c.set("rawApi", { websiteId: "site_1", apiKeyId: "k1", scopes } as never);
      }
      return next();
    });
    app.get("/thing", requireScope("analytics:read"), (c) => c.json({ ok: true }));
    return app;
  }

  it("admits a key that carries the scope", async () => {
    expect((await guarded(["analytics:read"]).request("/thing")).status).toBe(200);
  });

  it("refuses a key that carries a different scope", async () => {
    // Storing scopes and never checking them is the same as not having them.
    const res = await guarded(["heatmaps:read"]).request("/thing");
    expect(res.status).toBe(403);

    const body = (await res.json()) as { code: string; required_scope: string };
    expect(body.code).toBe("insufficient_scope");
    expect(body.required_scope).toBe("analytics:read");
  });

  it("admits a key with several scopes when one of them matches", async () => {
    expect((await guarded(["heatmaps:read", "analytics:read"]).request("/thing")).status).toBe(200);
  });

  it("treats a key with no scopes as unrestricted", async () => {
    // Keys minted before scoping carry none. Locking them out of everything would be a
    // breaking change dressed up as a security fix.
    expect((await guarded([]).request("/thing")).status).toBe(200);
  });

  it("answers 401 when no key context was established at all", async () => {
    expect((await guarded(null).request("/thing")).status).toBe(401);
  });
});
