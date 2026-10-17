import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "../../../tests/helpers/fake-db";
import { memoryEmbedLinks } from "../../../tests/helpers/memory-embed-links";
import { testConfig } from "../../../tests/helpers/test-config";
import { MemoryClientPortal, MemoryWhiteLabel, fakeClientDirectory, type FakeClient } from "../../../../modules/agency/tests/support/memory-agency";

mock.module("../../../../db", fakeDbModule);
mock.module("../../../../platform/observability/logger", fakeLogger);
mock.module("../../../../config", () => ({ env: () => testConfig() }));

/**
 * Client portal tokens on the embed API: one read path, one scoping rule. A portal token
 * for client A reads client A's sites and nothing else — not client B's, not a site of the
 * owner's outside any client, not another owner's — and stops on the next request once
 * revoked.
 */

let createEmbedRoutes: typeof import("../routes").createEmbedRoutes;
let PortalAccessService: typeof import("../../../../modules/agency/services/portal-access.service").PortalAccessService;
let ClientUserService: typeof import("../../../../modules/agency/services/client-user.service").ClientUserService;
let WhiteLabelService: typeof import("../../../../modules/agency/services/white-label.service").WhiteLabelService;

beforeAll(async () => {
  ({ createEmbedRoutes } = await import("../routes"));
  ({ PortalAccessService } = await import("../../../../modules/agency/services/portal-access.service"));
  ({ ClientUserService } = await import("../../../../modules/agency/services/client-user.service"));
  ({ WhiteLabelService } = await import("../../../../modules/agency/services/white-label.service"));
});

const OWNER = "99999999-9999-4999-8999-999999999999";
const OTHER_OWNER = "88888888-8888-4888-8888-888888888888";
const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THEIR_CLIENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const IN_A = "33333333-3333-4333-8333-333333333333";
const IN_B = "44444444-4444-4444-8444-444444444444";
const UNFILED = "55555555-5555-4555-8555-555555555555";
const THEIRS = "66666666-6666-4666-8666-666666666666";

const SITES = [
  { id: IN_A, ownerId: OWNER, clientId: CLIENT_A, name: "A shop", url: "a.shop" },
  { id: IN_B, ownerId: OWNER, clientId: CLIENT_B, name: "B shop", url: "b.shop" },
  { id: UNFILED, ownerId: OWNER, clientId: null, name: "Own", url: "own.app" },
  { id: THEIRS, ownerId: OTHER_OWNER, clientId: THEIR_CLIENT, name: "Theirs", url: "theirs.app" },
];

const ALL_ON = { analytics: true, heatmaps: true, replays: true, funnels: true, automations: true, errors: true };

let clients: FakeClient[];
let routes: ReturnType<typeof import("../routes").createEmbedRoutes>;
let portal: InstanceType<typeof PortalAccessService>;
let users: InstanceType<typeof ClientUserService>;
let whiteLabel: InstanceType<typeof WhiteLabelService>;
let calls: string[];

beforeEach(async () => {
  const mk = (id: string, ownerId: string, name: string): FakeClient => ({
    id, ownerId, name, company: "", status: "active", featuresEnabled: { ...ALL_ON }, websites: SITES.filter((s) => s.clientId === id),
  });
  clients = [mk(CLIENT_A, OWNER, "Client A"), mk(CLIENT_B, OWNER, "Client B"), mk(THEIR_CLIENT, OTHER_OWNER, "Their client")];
  const directory = fakeClientDirectory(clients);
  const store = new MemoryClientPortal();
  whiteLabel = new WhiteLabelService(new MemoryWhiteLabel());
  portal = new PortalAccessService({
    tokens: store.portalTokens,
    clients: directory,
    branding: whiteLabel,
    clientUsers: store.clientUsers,
    accountActive: async () => true,
  });
  users = new ClientUserService(store.clientUsers, directory, portal);
  calls = [];
  routes = createEmbedRoutes({
    embedLinks: await memoryEmbedLinks(),
    portal,
    branding: whiteLabel,
    clients: directory as never,
    websites: { getById: async (id: string) => SITES.find((s) => s.id === id) ?? null } as never,
    analytics: {
      canEmbedRead: (name: string) => name === "dashboard",
      embedRead: async (name: string, id: string) => (calls.push(`${name}:${id}`), { ok: true }),
    } as never,
    recordings: { listSessions: async (id: string) => (calls.push(`replays:${id}`), { sessions: [] }) } as never,
    heatmaps: { listPages: async (id: string) => (calls.push(`pages:${id}`), { pages: [] }) } as never,
    stylesheets: {} as never,
  });
});

const H = (token: string) => ({ headers: { "X-Embed-Token": token } });

describe("portal tokens on the embed API", () => {
  it("read their own client's site, and only that", async () => {
    const { token } = await portal.issueClientLink(OWNER, CLIENT_A);
    expect((await routes.request(`/${IN_A}/analytics/dashboard`, H(token))).status).toBe(200);
    expect((await routes.request(`/${IN_A}/analytics/dashboard?token=${token}`)).status).toBe(200);
    for (const site of [IN_B, UNFILED, THEIRS]) {
      expect((await routes.request(`/${site}/analytics/dashboard`, H(token))).status).toBe(401);
      expect((await routes.request(`/${site}/info`, H(token))).status).toBe(401);
      expect((await routes.request(`/${site}/replays`, H(token))).status).toBe(401);
    }
    expect(calls).toEqual([`dashboard:${IN_A}`, `dashboard:${IN_A}`]);
  });

  it("list their own client's websites, with the brand; never another client's", async () => {
    await whiteLabel.update(OWNER, { brandName: "Northwind", hideSeentics: true });
    const { link } = await users.invite(OWNER, { clientId: CLIENT_A, email: "jane@a.co", name: "Jane" });
    const res = await routes.request(`/client/${CLIENT_A}/websites`, H(link.token));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      client: { name: "Client A" },
      sections: ["analytics", "recordings", "heatmaps"],
      websites: [{ id: IN_A, name: "A shop", url: "a.shop" }],
      brand: expect.objectContaining({ brand_name: "Northwind", hide_seentics: true }),
    });
    for (const other of [CLIENT_B, THEIR_CLIENT]) {
      expect((await routes.request(`/client/${other}/websites`, H(link.token))).status).toBe(401);
    }
    const info = await (await routes.request(`/${IN_A}/info`, H(link.token))).json();
    expect(info.data.brand.brand_name).toBe("Northwind");
  });

  it("another owner's portal token cannot reach this owner's sites", async () => {
    const { token } = await portal.issueClientLink(OTHER_OWNER, THEIR_CLIENT);
    expect((await routes.request(`/${THEIRS}/analytics/dashboard`, H(token))).status).toBe(200);
    for (const site of [IN_A, IN_B, UNFILED]) {
      expect((await routes.request(`/${site}/analytics/dashboard`, H(token))).status).toBe(401);
    }
    expect((await routes.request(`/client/${CLIENT_A}/websites`, H(token))).status).toBe(401);
  });

  it("follow the client's feature switches as sections", async () => {
    clients[0]!.featuresEnabled.replays = false;
    const { token } = await portal.issueClientLink(OWNER, CLIENT_A);
    const res = await routes.request(`/${IN_A}/replays`, H(token));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("embed_section_disabled");
    expect((await routes.request(`/${IN_A}/heatmaps/pages`, H(token))).status).toBe(200);
  });

  it("stop on the next request once revoked, the user revoked, or the client suspended", async () => {
    const anon = await portal.issueClientLink(OWNER, CLIENT_A);
    const { clientUser, link } = await users.invite(OWNER, { clientId: CLIENT_A, email: "jane@a.co", name: "" });
    expect((await routes.request(`/${IN_A}/info`, H(anon.token))).status).toBe(200);
    expect((await routes.request(`/${IN_A}/info`, H(link.token))).status).toBe(200);

    await portal.revokeClientLinks(OWNER, CLIENT_A);
    expect((await routes.request(`/${IN_A}/info`, H(anon.token))).status).toBe(401);
    await users.revoke(OWNER, clientUser.id);
    expect((await routes.request(`/${IN_A}/info`, H(link.token))).status).toBe(401);

    const fresh = await portal.issueClientLink(OWNER, CLIENT_A);
    clients[0]!.status = "suspended";
    expect((await routes.request(`/${IN_A}/info`, H(fresh.token))).status).toBe(401);
  });

  it("a forged token with the portal prefix gets the embed API's one 401", async () => {
    const res = await routes.request(`/${IN_A}/info`, H(`scp_${"A".repeat(43)}`));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("invalid_embed_token");
  });
});
