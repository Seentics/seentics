import { beforeAll, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "../../../tests/helpers/fake-db";
import { testConfig } from "../../../tests/helpers/test-config";
import type { AccountScope, VerifiedAccountKey } from "../../../../modules/api-keys/interfaces";

mock.module("../../../../db", fakeDbModule);
mock.module("../../../../platform/observability/logger", fakeLogger);
mock.module("../../../../config", () => ({ env: () => testConfig() }));

let createRawDataRoutes: typeof import("../routes").createRawDataRoutes;
let createRawApiVerifier: typeof import("../../../../modules/api-keys/services/raw-api-verification.service").createRawApiVerifier;

beforeAll(async () => {
  ({ createRawDataRoutes } = await import("../routes"));
  ({ createRawApiVerifier } = await import("../../../../modules/api-keys/services/raw-api-verification.service"));
});

const MINE = "site-mine";
const THEIRS = "site-theirs";

/** Account keys by secret; `site-mine` belongs to owner-1, `site-theirs` to owner-2. */
function app(keys: Record<string, AccountScope[]>) {
  const lookups: string[] = [];
  const verifier = createRawApiVerifier({
    accountKeys: {
      verify: async (raw) => {
        const scopes = raw ? keys[raw] : undefined;
        return scopes ? ({ userId: "owner-1", apiKeyId: `id-${raw}`, scopes } as VerifiedAccountKey) : null;
      },
    },
    ownedWebsites: {
      getWebsite: async (ownerId: string, id: string) => {
        lookups.push(`${ownerId}:${id}`);
        return ownerId === "owner-1" && id === MINE ? ({ id } as never) : null;
      },
    },
  });
  const routes = createRawDataRoutes({
    analytics: new Proxy({}, { get: () => async () => ({}) }) as never,
    apiKeys: verifier,
    ports: {} as never,
  });
  return { routes, lookups };
}

const get = (r: ReturnType<typeof app>, site: string, path: string, key: string) =>
  r.routes.request(`/v1/websites/${site}/${path}`, { headers: { "X-API-Key": key } });

describe("raw API authenticated by an account key", () => {
  const keys = {
    full: ["websites:read", "websites:write", "analytics:read", "replays:read", "heatmaps:read"] as AccountScope[],
    analytics: ["analytics:read"] as AccountScope[],
    mgmt: ["websites:read", "websites:write"] as AccountScope[],
  };

  it("reads its own website's analytics with analytics:read", async () => {
    expect((await get(app(keys), MINE, "analytics/top-pages", "analytics")).status).toBe(200);
  });

  it("refuses a key without the scope for that data with 403 insufficient_scope", async () => {
    const res = await get(app(keys), MINE, "sessions", "analytics");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; required_scope: string };
    expect(body.code).toBe("insufficient_scope");
    expect(body.required_scope).toBe("replays:read");
  });

  it("refuses a websites:*-only key with 403, not unrestricted access", async () => {
    const res = await get(app(keys), MINE, "analytics/top-pages", "mgmt");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("insufficient_scope");
  });

  it("answers a website owned by someone else exactly like an invalid key", async () => {
    const a = app(keys);
    const foreign = await get(a, THEIRS, "analytics/top-pages", "full");
    const invalid = await get(a, MINE, "analytics/top-pages", "nope");
    const unknown = await get(a, "no-such-site", "analytics/top-pages", "full");
    expect(foreign.status).toBe(401);
    expect(unknown.status).toBe(401);
    const expected = await invalid.json();
    expect(await foreign.json()).toEqual(expected);
    expect(await unknown.json()).toEqual(expected);
  });

  it("checks ownership once per window, not once per request", async () => {
    const a = app(keys);
    await Promise.all(Array.from({ length: 10 }, () => get(a, MINE, "analytics/top-pages", "full")));
    await get(a, MINE, "analytics/top-pages", "full");
    expect(a.lookups).toEqual([`owner-1:${MINE}`]);
  });
});
