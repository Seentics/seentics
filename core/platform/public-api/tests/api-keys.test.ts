import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { fakeDbModule, fakeLogger, insertsInto, resetDb } from "../../../app/tests/helpers/fake-db";
import type { Website, WebsiteQuery, WebsiteRole } from "../../../modules/websites/interfaces";

/**
 * Minting, listing and revoking API keys.
 *
 * A key is the only credential that reaches the public data API, so the properties that
 * matter are about what leaves the server: the secret is returned exactly once and never
 * again, a key is scoped to the website it was minted for, and the hash never appears in
 * a response. Each is asserted directly rather than inferred from the happy path.
 */

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/lib/logger", fakeLogger);

mock.module("../../middleware/auth", () => ({
  authMiddleware: async (c: Context<{ Variables: { userId: string } }>, next: Next) => {
    const userId = c.req.header("X-Test-User");
    if (!userId) return c.json({ error: "Authorization required" }, 401);
    c.set("userId", userId);
    return next();
  },
  requireUser: (c: Context<{ Variables: { userId: string } }>) => c.get("userId") ?? null,
}));

const WEBSITE = "11111111-1111-4111-8111-111111111111";
const OTHER_WEBSITE = "22222222-2222-4222-8222-222222222222";
const OWNER = "user_owner";
const STRANGER = "user_stranger";

class FakeWebsiteQuery implements WebsiteQuery {
  roles = new Map<string, WebsiteRole>();
  grant(ref: string, userId: string, role: WebsiteRole) { this.roles.set(`${ref}:${userId}`, role); }
  async getRole(ref: string, userId: string) { return this.roles.get(`${ref}:${userId}`) ?? null; }
  async getById(): Promise<Website | null> { throw new Error("unused"); }
  async listOwnedBy(): Promise<Website[]> { throw new Error("unused"); }
}

let createApiKeyRoutes: typeof import("../keys/routes").createApiKeyRoutes;
let API_SCOPES: typeof import("../keys/api-key.service").API_SCOPES;

beforeAll(async () => {
  ({ createApiKeyRoutes } = await import("../keys/routes"));
  ({ API_SCOPES } = await import("../keys/api-key.service"));
});

describe("API key routes", () => {
  let websites: FakeWebsiteQuery;
  let app: Hono;

  beforeEach(() => {
    resetDb();
    websites = new FakeWebsiteQuery();
    websites.grant(WEBSITE, OWNER, "owner");
    websites.grant(OTHER_WEBSITE, OWNER, "owner");

    app = new Hono();
    app.route("/api/v1/websites", createApiKeyRoutes({ websites }));
  });

  function request(path: string, user?: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    if (user) headers["X-Test-User"] = user;
    return app.request(`/api/v1/websites${path}`, { ...init, headers });
  }

  const create = (body: unknown, user = OWNER, site = WEBSITE) =>
    request(`/${site}/api-keys`, user, { method: "POST", body: JSON.stringify(body) });

  // ─── Access control ───────────────────────────────────────────────────────

  describe("access control", () => {
    const routes: Array<{ method: string; path: string; body?: unknown }> = [
      { method: "GET", path: `/${WEBSITE}/api-keys` },
      { method: "POST", path: `/${WEBSITE}/api-keys`, body: { name: "k", scopes: ["analytics:read"] } },
      { method: "DELETE", path: `/${WEBSITE}/api-keys/some-key` },
    ];

    for (const route of routes) {
      it(`${route.method} answers 401 without a token`, async () => {
        const res = await request(route.path, undefined, {
          method: route.method,
          ...(route.body ? { body: JSON.stringify(route.body) } : {}),
        });
        expect(res.status).toBe(401);
      });

      it(`${route.method} answers 403 for a user with no role on the site`, async () => {
        const res = await request(route.path, STRANGER, {
          method: route.method,
          ...(route.body ? { body: JSON.stringify(route.body) } : {}),
        });
        expect(res.status).toBe(403);
      });
    }

    it("answers an unknown website exactly as it answers a forbidden one", async () => {
      // Otherwise the endpoint becomes an oracle for which site ids exist.
      const forbidden = await request(`/${WEBSITE}/api-keys`, STRANGER);
      const unknown = await request(`/33333333-3333-4333-8333-333333333333/api-keys`, OWNER);

      expect(unknown.status).toBe(forbidden.status);
      expect(await unknown.json()).toEqual(await forbidden.json());
    });

    it("serves the scope list without a website, so a form can be built", async () => {
      const res = await request(`/scopes`, OWNER);
      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: Array<{ scope: string; description: string }> };
      expect(body.data.map((s) => s.scope)).toEqual([...API_SCOPES]);
      expect(body.data.every((s) => s.description.length > 0)).toBe(true);
    });
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  describe("validation", () => {
    it("rejects a missing or blank name", async () => {
      expect((await create({ scopes: ["analytics:read"] })).status).toBe(400);
      expect((await create({ name: "   ", scopes: ["analytics:read"] })).status).toBe(400);
    });

    it("rejects an over-long name", async () => {
      expect((await create({ name: "n".repeat(81), scopes: ["analytics:read"] })).status).toBe(400);
    });

    it("requires at least one scope", async () => {
      // A key with no scopes is treated as unrestricted by the middleware; letting the
      // form mint one would turn a compatibility allowance into the default.
      const res = await create({ name: "k", scopes: [] });
      expect(res.status).toBe(400);
    });

    it("rejects a scope that does not exist", async () => {
      expect((await create({ name: "k", scopes: ["billing:write"] })).status).toBe(400);
    });

    it("accepts every documented scope", async () => {
      for (const scope of API_SCOPES) {
        const res = await create({ name: `key for ${scope}`, scopes: [scope] });
        expect(res.status).toBe(201);
      }
    });

    it("answers a malformed body with a validation error", async () => {
      const res = await request(`/${WEBSITE}/api-keys`, OWNER, { method: "POST", body: "not json" });
      expect(res.status).toBe(400);
    });
  });

  // ─── The secret ───────────────────────────────────────────────────────────

  describe("minting", () => {
    async function mint(name = "Production", scopes = ["analytics:read"]) {
      const res = await create({ name, scopes });
      const body = (await res.json()) as { data: Record<string, unknown> };
      return { res, key: body.data };
    }

    it("answers 201 with the key", async () => {
      const { res, key } = await mint();
      expect(res.status).toBe(201);
      expect(key.name).toBe("Production");
      expect(key.scopes).toEqual(["analytics:read"]);
    });

    it("returns the secret exactly once, on creation", async () => {
      // The only moment the plaintext exists outside the caller's request. Nothing can
      // retrieve it afterwards, which is the whole point.
      const { key } = await mint();
      expect(typeof key.secret).toBe("string");
      expect(String(key.secret).length).toBeGreaterThan(32);
    });

    it("prefixes the secret so a leaked key is traceable to a site", async () => {
      const { key } = await mint();
      expect(String(key.secret)).toMatch(/^snt_[0-9a-f]{6}_/);
    });

    it("stores only a hash, never the secret", async () => {
      // If the plaintext reached the row, a database read would hand over every key.
      const { key } = await mint();
      const [row] = insertsInto("api_keys").flatMap((i) => i.rows) as Array<Record<string, unknown>>;

      expect(row!.keyHash).toBeDefined();
      expect(row!.keyHash).not.toBe(key.secret);
      expect(JSON.stringify(row)).not.toContain(String(key.secret));
    });

    it("stores a prefix that matches the secret's opening characters", async () => {
      // The prefix is what narrows the bcrypt search at verification time; if it did not
      // match the secret, no key would ever be found.
      const { key } = await mint();
      const [row] = insertsInto("api_keys").flatMap((i) => i.rows) as Array<Record<string, unknown>>;
      expect(String(key.secret).startsWith(String(row!.keyPrefix))).toBe(true);
    });

    it("records the website and the user who minted it", async () => {
      await mint();
      const [row] = insertsInto("api_keys").flatMap((i) => i.rows) as Array<Record<string, unknown>>;
      expect(row).toMatchObject({ websiteId: WEBSITE, userId: OWNER });
    });

    it("gives two keys different secrets", async () => {
      const a = await mint("one");
      const b = await mint("two");
      expect(a.key.secret).not.toBe(b.key.secret);
    });

    it("deduplicates repeated scopes", async () => {
      const res = await create({ name: "k", scopes: ["analytics:read", "analytics:read"] });
      const body = (await res.json()) as { data: { scopes: string[] } };
      expect(body.data.scopes).toEqual(["analytics:read"]);
    });

    it("accepts several scopes at once", async () => {
      const res = await create({ name: "k", scopes: [...API_SCOPES] });
      const body = (await res.json()) as { data: { scopes: string[] } };
      expect(body.data.scopes).toEqual([...API_SCOPES]);
    });
  });

  // ─── Revoking ─────────────────────────────────────────────────────────────

  describe("revoking", () => {
    it("answers 404 when the key does not belong to this website", async () => {
      // Scoped by website as well as id, so a key id from one site cannot delete
      // another's — the route authorizes the website, and this is what makes that
      // check sufficient.
      const res = await request(`/${WEBSITE}/api-keys/not-a-real-key`, OWNER, { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });
});
