import { beforeAll, describe, expect, it, mock } from "bun:test";
import * as jose from "jose";
import { fakeDbModule, fakeLogger } from "../../../tests/helpers/fake-db";
import { testConfig } from "../../../tests/helpers/test-config";

mock.module("../../../../db", fakeDbModule);
mock.module("../../../../platform/observability/logger", fakeLogger);
// Global to the whole run — see `testConfig` for why it must be complete.
mock.module("../../../../config", () => ({ env: () => testConfig() }));

let createEmbedRoutes: typeof import("../routes").createEmbedRoutes;
let embedTokens: typeof import("../../../../modules/api-keys/services/embed-token.service").embedTokens;
let signAccessToken: typeof import("../../../../platform/security/auth-jwt").signAccessToken;

beforeAll(async () => {
  ({ createEmbedRoutes } = await import("../routes"));
  ({ embedTokens } = await import("../../../../modules/api-keys/services/embed-token.service"));
  ({ signAccessToken } = await import("../../../../platform/security/auth-jwt"));
});

const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function app() {
  const calls: string[] = [];
  const read = (name: string) => async (websiteId: string) => {
    calls.push(`${name}:${websiteId}`);
    return { [name]: true };
  };
  const routes = createEmbedRoutes({
    embedTokens,
    analytics: new Proxy({}, { get: (_t, name) => read(String(name)) }) as never,
    websites: { getById: async (id: string) => (id === SITE || id === OTHER ? { id, name: "Acme", url: "acme.app" } : null) } as never,
  });
  return { routes, calls };
}

describe("embed tokens", () => {
  it("round-trip to the website they were issued for", async () => {
    const { token } = await embedTokens.issue(SITE);
    expect(await embedTokens.verify(token)).toEqual({ websiteId: SITE });
  });

  it("clamp the lifetime to 5 minutes – 30 days", async () => {
    const short = await embedTokens.issue(SITE, 1);
    expect(short.expiresAt.getTime() - Date.now()).toBeGreaterThan(4 * 60 * 1000);
    const long = await embedTokens.issue(SITE, 10 ** 9);
    expect(long.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 24 * 3600 * 1000 + 1000);
  });

  it("are not accepted in place of a session token, nor a session token in place of them", async () => {
    // Same secret, different `typ`: neither may stand in for the other.
    expect(await embedTokens.verify(await signAccessToken("user-1"))).toBeNull();
  });

  it("reject a token signed with another secret", async () => {
    const forged = await new jose.SignJWT({ typ: "embed", wid: SITE })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("not-the-secret-not-the-secret-not-the-secret"));
    expect(await embedTokens.verify(forged)).toBeNull();
  });
});

describe("GET /:websiteId/summary", () => {
  it("answers everything the embed draws in one call", async () => {
    const { routes, calls } = app();
    const { token } = await embedTokens.issue(SITE);
    const res = await routes.request(`/${SITE}/summary?days=7`, { headers: { "X-Embed-Token": token } });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.website).toEqual({ name: "Acme", url: "acme.app" });
    expect(data.days).toBe(7);
    expect(Object.keys(data)).toEqual(
      expect.arrayContaining(["dashboard", "daily", "top_pages", "top_referrers", "top_countries", "top_devices"]),
    );
    expect(calls.every((c) => c.endsWith(SITE))).toBe(true);
  });

  it("accepts the token as ?token= for a plain link", async () => {
    const { routes } = app();
    const { token } = await embedTokens.issue(SITE);
    expect((await routes.request(`/${SITE}/summary?token=${token}`)).status).toBe(200);
  });

  it("refuses a token issued for another website", async () => {
    const { routes, calls } = app();
    const { token } = await embedTokens.issue(OTHER);
    const res = await routes.request(`/${SITE}/summary`, { headers: { "X-Embed-Token": token } });
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("refuses a missing token", async () => {
    expect((await app().routes.request(`/${SITE}/summary`)).status).toBe(401);
  });

  it("only offers the three windows the embed has buttons for", async () => {
    const { routes } = app();
    const { token } = await embedTokens.issue(SITE);
    const res = await routes.request(`/${SITE}/summary?days=365`, { headers: { "X-Embed-Token": token } });
    expect(res.status).toBe(400);
  });
});
