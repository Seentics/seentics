import { beforeAll, describe, expect, it, mock } from "bun:test";
import * as jose from "jose";
import { fakeDbModule, fakeLogger } from "../../../tests/helpers/fake-db";
import { memoryEmbedLinks } from "../../../tests/helpers/memory-embed-links";
import type { EmbedSection } from "../../../../modules/api-keys/interfaces";
import { AnalyticsReadFacade } from "../../../../modules/analytics/services/analytics-read-facade.service";

/** The real read facade over stub services, so the tests exercise the real name table and query parsing. */
const facadeOver = (service: object) =>
  new AnalyticsReadFacade(service as never, service as never, service as never, service as never, service as never, service as never) as never;

import { testConfig } from "../../../tests/helpers/test-config";

mock.module("../../../../db", fakeDbModule);
mock.module("../../../../platform/observability/logger", fakeLogger);
// Global to the whole run — see `testConfig` for why it must be complete.
mock.module("../../../../config", () => ({ env: () => testConfig() }));

// Every `/analytics/<name>/${websiteId}` call in web/src/features/analytics/api.ts and queries.ts
// that the Overview page makes (path-analysis, revenue and the public dashboard are not embeddable).
const DASHBOARD_NAMES = [
  "dashboard", "daily-stats", "hourly-stats", "top-pages", "top-referrers", "top-countries",
  "top-browsers", "top-devices", "top-os", "top-resolutions", "top-languages", "top-cities",
  "dimensions-bulk", "live-visitors", "custom-events", "visitor-insights", "geolocation-breakdown",
  "goals-stats", "traffic-summary", "activity-trends", "top-sources",
];

let createEmbedRoutes: typeof import("../routes").createEmbedRoutes;
let EMBED_ANALYTICS_READS: typeof import("../../../../modules/analytics/embed-reads").EMBED_ANALYTICS_READS;
let signAccessToken: typeof import("../../../../platform/security/auth-jwt").signAccessToken;

beforeAll(async () => {
  ({ createEmbedRoutes } = await import("../routes"));
  ({ EMBED_ANALYTICS_READS } = await import("../../../../modules/analytics/embed-reads"));
  ({ signAccessToken } = await import("../../../../platform/security/auth-jwt"));
});

const OWNER = "99999999-9999-4999-8999-999999999999";
const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IN_A = "33333333-3333-4333-8333-333333333333";
const IN_B = "44444444-4444-4444-8444-444444444444";

type Site = { id: string; ownerId: string; name: string; url: string; clientId: string | null };
const SITES: Site[] = [
  { id: SITE, ownerId: OWNER, name: "Acme", url: "acme.app", clientId: null },
  { id: OTHER, ownerId: OWNER, name: "Other", url: "other.app", clientId: null },
  { id: IN_A, ownerId: OWNER, name: "A shop", url: "a.shop", clientId: CLIENT_A },
  { id: IN_B, ownerId: OWNER, name: "B shop", url: "b.shop", clientId: CLIENT_B },
];

const recordingsStub = (calls: string[]) => ({
  listSessions: async (id: string, limit: number, offset: number, f: unknown) => (calls.push(`listSessions:${id}`), { sessions: [], limit, offset, total: 0, filters: f }),
  getSessionDetail: async (id: string, sid: string) => (calls.push(`detail:${id}:${sid}`), { status: 200, body: { session: sid } }),
}) as never;
const heatmapsStub = (calls: string[]) => ({
  listPages: async (id: string, days?: number) => (calls.push(`pages:${id}:${days}`), { pages: [] }),
  getPoints: async (id: string, path: string, type: string) => (calls.push(`points:${id}:${path}:${type}`), { points: [] }),
  getLayoutSnapshot: async (id: string, path: string, device?: string) => (calls.push(`layout:${id}:${path}:${device}`), { layout: null }),
}) as never;

async function setup(clientStatus = "active") {
  const embedLinks = await memoryEmbedLinks();
  const calls: string[] = [];
  const read = (name: string) => async (websiteId: string) => {
    calls.push(`${name}:${websiteId}`);
    return { [name]: true };
  };
  const clientsById: Record<string, { name: string; status: string }> = {
    [CLIENT_A]: { name: "Client A", status: clientStatus },
    [CLIENT_B]: { name: "Client B", status: "active" },
  };
  const routes = createEmbedRoutes({
    embedLinks,
    analytics: facadeOver(new Proxy({}, { get: (_t, name) => read(String(name)) })),
    websites: { getById: async (id: string) => SITES.find((s) => s.id === id) ?? null } as never,
    clients: {
      getClient: async (ownerId: string, id: string) => {
        const c = clientsById[id];
        if (!c || ownerId !== OWNER) return null;
        return { id, ...c, websites: SITES.filter((s) => s.clientId === id) };
      },
    } as never,
    recordings: recordingsStub(calls),
    heatmaps: heatmapsStub(calls),
  });
  const tokenFor = async (target: { websiteId: string } | { clientId: string }, sections?: EmbedSection[]) =>
    embedLinks.tokenFor((await embedLinks.getOrCreate(OWNER, target, sections)).link);
  return { routes, calls, embedLinks, tokenFor };
}

describe("embed links", () => {
  it("get-or-create is idempotent and the token is stable", async () => {
    const { embedLinks } = await setup();
    const first = await embedLinks.getOrCreate(OWNER, { websiteId: SITE });
    const again = await embedLinks.getOrCreate(OWNER, { websiteId: SITE });
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.link.id).toBe(first.link.id);
    expect(await embedLinks.tokenFor(again.link)).toBe(await embedLinks.tokenFor(first.link));
  });

  it("round-trips to the target, and never expires", async () => {
    const { embedLinks, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE });
    expect(await embedLinks.verify(token)).toMatchObject({ scope: "website", targetId: SITE });
    expect(jose.decodeJwt(token).exp).toBeUndefined();
    expect(jose.decodeJwt(token)).toMatchObject({ typ: "embed", wid: SITE });
    expect(jose.decodeJwt(await tokenFor({ clientId: CLIENT_A }))).toMatchObject({ cid: CLIENT_A });
  });

  it("fails once revoked, and a new link after that is a different URL", async () => {
    const { embedLinks, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE });
    expect(await embedLinks.verify(token)).not.toBeNull(); // warms the cache
    const { link } = await embedLinks.getOrCreate(OWNER, { websiteId: SITE });
    expect(await embedLinks.revoke(link.id)).toBe(true);
    expect(await embedLinks.verify(token)).toBeNull();
    const fresh = await tokenFor({ websiteId: SITE });
    expect(fresh).not.toBe(token);
    expect(await embedLinks.verify(fresh)).not.toBeNull();
    expect(await embedLinks.verify(token)).toBeNull();
  });

  it("rejects forged tokens: other secret, unknown link, no lid, a session token", async () => {
    const { embedLinks } = await setup();
    const sign = (claims: Record<string, unknown>, key = "x".repeat(48)) =>
      new jose.SignJWT({ typ: "embed", ...claims }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode(key));
    expect(await embedLinks.verify(await sign({ lid: crypto.randomUUID(), wid: SITE }))).toBeNull();
    // Signed with the real secret but naming a link that does not exist.
    const real = new TextEncoder().encode(testConfig().jwtSecret);
    const key = testConfig().jwtSecret;
    expect(key).toBeTruthy();
    expect(await embedLinks.verify(await new jose.SignJWT({ typ: "embed", lid: crypto.randomUUID(), wid: SITE }).setProtectedHeader({ alg: "HS256" }).sign(real))).toBeNull();
    // The old, link-less embed token shape.
    expect(await embedLinks.verify(await new jose.SignJWT({ typ: "embed", wid: SITE }).setProtectedHeader({ alg: "HS256" }).sign(real))).toBeNull();
    expect(await embedLinks.verify(await signAccessToken("user-1"))).toBeNull();
    expect(await embedLinks.verify("garbage")).toBeNull();
    expect(await embedLinks.verify(undefined)).toBeNull();
  });

  it("rejects a token whose target was altered, even when the link is live", async () => {
    const { embedLinks } = await setup();
    const { link } = await embedLinks.getOrCreate(OWNER, { websiteId: SITE });
    const real = new TextEncoder().encode(testConfig().jwtSecret);
    const mismatched = await new jose.SignJWT({ typ: "embed", lid: link.id, wid: OTHER }).setProtectedHeader({ alg: "HS256" }).sign(real);
    expect(await embedLinks.verify(mismatched)).toBeNull();
  });

  it("lists only the owner's live links", async () => {
    const { embedLinks } = await setup();
    const a = await embedLinks.getOrCreate(OWNER, { websiteId: SITE });
    await embedLinks.getOrCreate(OWNER, { clientId: CLIENT_A });
    await embedLinks.getOrCreate("someone-else", { websiteId: OTHER });
    await embedLinks.revoke(a.link.id);
    const listed = await embedLinks.listLive(OWNER);
    expect(listed.map((l) => l.scope)).toEqual(["client"]);
  });
});

const H = (token: string) => ({ headers: { "X-Embed-Token": token } });

describe("GET /:websiteId/analytics/:name", () => {
  it("returns the analytics service's output for the site, with the dashboard's query handling", async () => {
    const { routes, calls, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE });
    const res = await routes.request(`/${SITE}/analytics/daily-stats?days=7&timezone=UTC&limit=5&live=0`, H(token));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(await res.json()).toEqual({ getDailyStats: true });
    expect(calls).toEqual([`getDailyStats:${SITE}`]);
  });

  it("passes days, timezone, limit and live=0 through exactly like the dashboard", async () => {
    const seen: unknown[] = [];
    const embedLinks = await memoryEmbedLinks();
    const routes = createEmbedRoutes({
      embedLinks,
      analytics: facadeOver({ getPages: async (_id: string, q: unknown) => (seen.push(q), []) }),
      websites: { getById: async (id: string) => SITES.find((s) => s.id === id) ?? null } as never,
      clients: {} as never,
      recordings: {} as never,
      heatmaps: {} as never,
    });
    const token = await embedLinks.tokenFor((await embedLinks.getOrCreate(OWNER, { websiteId: SITE })).link);
    await routes.request(`/${SITE}/analytics/top-pages?days=7&timezone=Asia/Dhaka&limit=3&live=0`, H(token));
    await routes.request(`/${SITE}/analytics/top-pages?live=1`, H(token));
    expect(seen).toEqual([
      { days: "7", timezone: "Asia/Dhaka", limit: "3", live: "0" },
      { days: undefined, timezone: undefined, limit: undefined },
    ]);
  });

  it("accepts the token as ?token= and keeps live visitors out of every cache", async () => {
    const { routes, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE });
    const res = await routes.request(`/${SITE}/analytics/live-visitors?token=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("serves exactly the allowlist, and nothing else", async () => {
    const { routes, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE });
    expect(Object.keys(EMBED_ANALYTICS_READS).sort()).toEqual([...DASHBOARD_NAMES].sort());
    for (const name of DASHBOARD_NAMES) {
      expect((await routes.request(`/${SITE}/analytics/${name}`, H(token))).status).toBe(200);
    }
    for (const name of ["export", "revenue", "path-analysis", "page-utm-breakdown", "recordings", "heatmaps", "constructor", "__proto__", "toString"]) {
      expect((await routes.request(`/${SITE}/analytics/${name}`, H(token))).status).toBe(404);
    }
  });

  it("is read-only", async () => {
    const { routes, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE });
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect((await routes.request(`/${SITE}/analytics/daily-stats`, { method, ...H(token) })).status).toBe(404);
    }
  });

  it("refuses a website token on another website, with the generic error", async () => {
    const { routes, calls, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: OTHER });
    const res = await routes.request(`/${SITE}/analytics/daily-stats`, H(token));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("invalid_embed_token");
    expect(calls).toEqual([]);
  });

  it("refuses a missing token and a revoked link", async () => {
    const { routes, embedLinks, tokenFor } = await setup();
    expect((await routes.request(`/${SITE}/analytics/daily-stats`)).status).toBe(401);
    const token = await tokenFor({ websiteId: SITE });
    await embedLinks.revoke((await embedLinks.findLive({ websiteId: SITE }))!.id);
    const res = await routes.request(`/${SITE}/analytics/daily-stats`, H(token));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("invalid_embed_token");
  });

  it("reads a member website with a client token, and no other client's website", async () => {
    const { routes, tokenFor } = await setup();
    const token = await tokenFor({ clientId: CLIENT_A });
    expect((await routes.request(`/${IN_A}/analytics/daily-stats`, H(token))).status).toBe(200);
    expect((await routes.request(`/${IN_B}/analytics/daily-stats`, H(token))).status).toBe(401);
    expect((await routes.request(`/${SITE}/analytics/daily-stats`, H(token))).status).toBe(401);
  });

  it("refuses a client token while the client is suspended or archived", async () => {
    for (const status of ["suspended", "archived"]) {
      const { routes, tokenFor } = await setup(status);
      const token = await tokenFor({ clientId: CLIENT_A });
      expect((await routes.request(`/${IN_A}/analytics/daily-stats`, H(token))).status).toBe(401);
    }
  });

  it("no longer serves the old summary bundle", async () => {
    const { routes, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE });
    expect((await routes.request(`/${SITE}/summary`, H(token))).status).toBe(404);
  });
});

describe("GET /:websiteId/info", () => {
  it("names the site for its own token, and refuses another site's", async () => {
    const { routes, tokenFor } = await setup();
    const res = await routes.request(`/${SITE}/info`, H(await tokenFor({ websiteId: SITE })));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(await res.json()).toEqual({ data: { website: { name: "Acme", url: "acme.app" }, sections: ["analytics"] } });
    const other = await routes.request(`/${SITE}/info`, H(await tokenFor({ websiteId: OTHER })));
    expect(other.status).toBe(401);
    expect((await other.json()).code).toBe("invalid_embed_token");
    expect((await routes.request(`/${SITE}/info`)).status).toBe(401);
  });

  it("serves a client token's member sites only", async () => {
    const { routes, tokenFor } = await setup();
    const token = await tokenFor({ clientId: CLIENT_A });
    expect((await routes.request(`/${IN_A}/info`, H(token))).status).toBe(200);
    expect((await routes.request(`/${IN_B}/info`, H(token))).status).toBe(401);
  });
});

describe("GET /client/:clientId/websites", () => {
  it("lists only that client's websites", async () => {
    const { routes, tokenFor } = await setup();
    const token = await tokenFor({ clientId: CLIENT_A });
    const res = await routes.request(`/client/${CLIENT_A}/websites`, { headers: { "X-Embed-Token": token } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect((await res.json()).data).toEqual({
      client: { name: "Client A" },
      sections: ["analytics"],
      websites: [{ id: IN_A, name: "A shop", url: "a.shop" }],
    });
  });

  it("refuses another client's id, a website token, and a revoked link", async () => {
    const { routes, embedLinks, tokenFor } = await setup();
    const clientToken = await tokenFor({ clientId: CLIENT_A });
    const siteToken = await tokenFor({ websiteId: SITE });
    const get = (id: string, token: string) => routes.request(`/client/${id}/websites?token=${token}`);
    expect((await get(CLIENT_B, clientToken)).status).toBe(401);
    const res = await get(CLIENT_A, siteToken);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("invalid_embed_token");
    await embedLinks.revoke((await embedLinks.findLive({ clientId: CLIENT_A }))!.id);
    expect((await get(CLIENT_A, clientToken)).status).toBe(401);
  });
});

describe("sections", () => {
  const code = async (res: Response) => (await res.json()).code;

  it("a new link defaults to analytics only; an explicit list is kept (canonical order)", async () => {
    const { embedLinks } = await setup();
    expect((await embedLinks.getOrCreate(OWNER, { websiteId: SITE })).link.sections).toEqual(["analytics"]);
    const made = await embedLinks.getOrCreate(OWNER, { websiteId: OTHER }, ["heatmaps", "recordings"]);
    expect(made.link.sections).toEqual(["recordings", "heatmaps"]);
    // get-or-create returns an existing link as is; sections passed later are ignored.
    expect((await embedLinks.getOrCreate(OWNER, { websiteId: OTHER }, ["analytics"])).link.sections).toEqual(["recordings", "heatmaps"]);
  });

  it("analytics routes need the analytics section", async () => {
    const { routes, calls, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE }, ["recordings"]);
    const res = await routes.request(`/${SITE}/analytics/daily-stats`, H(token));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "section not enabled for this link", code: "embed_section_disabled" });
    expect(calls).toEqual([]);
    // info still works and reports the sections.
    expect((await (await routes.request(`/${SITE}/info`, H(token))).json()).data.sections).toEqual(["recordings"]);
  });

  const READS: Array<[EmbedSection, string, string]> = [
    ["recordings", "/replays?limit=5&days=7", "listSessions"],
    ["recordings", "/replays/sess-1", "detail:"],
    ["heatmaps", "/heatmaps/pages?days=30", "pages:"],
    ["heatmaps", "/heatmaps/data?page_path=/a&event_type=scroll", "points:"],
    ["heatmaps", "/heatmaps/layout-snapshot?page_path=/a&device=mobile", "layout:"],
  ];

  for (const [section, path, call] of READS) {
    it(`${path.split("?")[0]}: 403 when ${section} is off, 200 when on, 401 for another site's token`, async () => {
      const { routes, calls, tokenFor } = await setup();
      const off = await routes.request(`/${SITE}${path}`, H(await tokenFor({ websiteId: SITE })));
      expect(off.status).toBe(403);
      expect(await code(off)).toBe("embed_section_disabled");
      expect(calls).toEqual([]);

      const on = await setup();
      const token = await on.tokenFor({ websiteId: SITE }, ["analytics", section]);
      const ok = await on.routes.request(`/${SITE}${path}`, H(token));
      expect(ok.status).toBe(200);
      expect(ok.headers.get("Cache-Control")).toMatch(/^private, (max-age=60|no-store)$/);
      expect(on.calls.length).toBe(1);
      expect(on.calls[0]).toContain(call);
      expect(on.calls[0]).toContain(SITE);

      const wrong = await on.routes.request(`/${SITE}${path}`, H(await on.tokenFor({ websiteId: OTHER }, [section])));
      expect(wrong.status).toBe(401);
      expect(await code(wrong)).toBe("invalid_embed_token");
      expect((await on.routes.request(`/${SITE}${path}`)).status).toBe(401);
    });
  }

  it("passes the dashboard's query handling through", async () => {
    const { routes, calls, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE }, ["recordings", "heatmaps"]);
    const list = await (await routes.request(`/${SITE}/replays?search=x&device=bad`, H(token))).status;
    expect(list).toBe(400);
    await routes.request(`/${SITE}/heatmaps/data?page_path=/p&event_type=scroll`, H(token));
    expect(calls).toEqual([`points:${SITE}:/p:scroll`]);
    expect((await routes.request(`/${SITE}/heatmaps/data`, H(token))).status).toBe(400);
  });

  it("changing sections applies at once to the same token", async () => {
    const { routes, embedLinks, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE });
    const link = (await embedLinks.findLive({ websiteId: SITE }))!;
    expect((await routes.request(`/${SITE}/replays`, H(token))).status).toBe(403);
    await embedLinks.setSections(link.id, ["analytics", "recordings"]);
    expect((await routes.request(`/${SITE}/replays`, H(token))).status).toBe(200);
    await embedLinks.setSections(link.id, ["recordings"]);
    expect((await routes.request(`/${SITE}/analytics/daily-stats`, H(token))).status).toBe(403);
    await embedLinks.setSections(link.id, ["analytics"]);
    expect((await routes.request(`/${SITE}/replays`, H(token))).status).toBe(403);
    expect((await routes.request(`/${SITE}/analytics/daily-stats`, H(token))).status).toBe(200);
  });

  it("a client token reads a member site's recordings only with the recordings section", async () => {
    const { routes, tokenFor } = await setup();
    const plain = await tokenFor({ clientId: CLIENT_A });
    expect((await routes.request(`/${IN_A}/replays`, H(plain))).status).toBe(403);
    // a fresh setup has its own link rows
    const s2 = await setup();
    const token2 = await s2.tokenFor({ clientId: CLIENT_A }, ["recordings"]);
    expect((await s2.routes.request(`/${IN_A}/replays`, H(token2))).status).toBe(200);
    expect((await s2.routes.request(`/${IN_B}/replays`, H(token2))).status).toBe(401);
    expect((await s2.routes.request(`/${SITE}/replays`, H(token2))).status).toBe(401);
    const info = await (await s2.routes.request(`/client/${CLIENT_A}/websites`, H(token2))).json();
    expect(info.data.sections).toEqual(["recordings"]);
  });

  it("embed reads are GET only: every write method 404s, even with every section on", async () => {
    const { routes, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE }, ["analytics", "recordings", "heatmaps"]);
    const paths = ["/replays", "/replays/sess-1", "/replays/batch", "/heatmaps/pages", "/heatmaps/data", "/heatmaps/layout-snapshot", "/heatmaps/save-screenshot", "/heatmaps/playwright-screenshot", "/heatmaps/bulk-delete"];
    for (const path of paths) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect((await routes.request(`/${SITE}${path}`, { method, ...H(token) })).status).toBe(404);
      }
    }
    for (const path of ["/heatmaps/save-screenshot", "/heatmaps/playwright-screenshot", "/heatmaps/bulk-delete", "/heatmaps/playwright-batch-screenshots"]) {
      expect((await routes.request(`/${SITE}${path}`, H(token))).status).toBe(404);
    }
  });

  it("a revoked link is 401 on the new routes", async () => {
    const { routes, embedLinks, tokenFor } = await setup();
    const token = await tokenFor({ websiteId: SITE }, ["recordings", "heatmaps"]);
    await embedLinks.revoke((await embedLinks.findLive({ websiteId: SITE }))!.id);
    for (const path of ["/replays", "/replays/s", "/heatmaps/pages"]) {
      expect((await routes.request(`/${SITE}${path}`, H(token))).status).toBe(401);
    }
  });
});
