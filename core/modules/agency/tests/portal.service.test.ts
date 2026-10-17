import { beforeEach, describe, expect, it } from "bun:test";
import { CLIENT_USER_LINK_TTL_DAYS, PORTAL_LINK_TTL_DAYS, PORTAL_TOKEN_PREFIX, AgencyOperationError } from "../interfaces";
import { PortalAccessService, sectionsForFeatures } from "../services/portal-access.service";
import { ClientUserService } from "../services/client-user.service";
import { WhiteLabelService } from "../services/white-label.service";
import { hashPortalToken, isPortalTokenShape, sameDigest } from "../lib/portal-token";
import { MemoryClientPortal, MemoryWhiteLabel, fakeClientDirectory, type FakeClient } from "./support/memory-agency";

const OWNER = "99999999-9999-4999-8999-999999999999";
const OTHER_OWNER = "88888888-8888-4888-8888-888888888888";
const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FOREIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ALL_ON = { analytics: true, heatmaps: true, replays: true, funnels: true, automations: true, errors: true };
const DAY = 86_400_000;

let clients: FakeClient[];
let store: MemoryClientPortal;
let whiteLabel: WhiteLabelService;
let active: Set<string>;
let now: Date;
let portal: PortalAccessService;
let users: ClientUserService;

beforeEach(() => {
  clients = [
    { id: CLIENT_A, ownerId: OWNER, name: "Client A", company: "A Co", status: "active", featuresEnabled: { ...ALL_ON },
      websites: [{ id: "site-a", ownerId: OWNER, clientId: CLIENT_A, name: "A shop", url: "a.shop" }] },
    { id: CLIENT_B, ownerId: OWNER, name: "Client B", company: "", status: "active", featuresEnabled: { ...ALL_ON },
      websites: [{ id: "site-b", ownerId: OWNER, clientId: CLIENT_B, name: "B shop", url: "b.shop" }] },
    { id: FOREIGN, ownerId: OTHER_OWNER, name: "Theirs", company: "", status: "active", featuresEnabled: { ...ALL_ON }, websites: [] },
  ];
  now = new Date("2026-10-17T00:00:00Z");
  store = new MemoryClientPortal();
  store.now = () => now;
  whiteLabel = new WhiteLabelService(new MemoryWhiteLabel());
  active = new Set([OWNER, OTHER_OWNER]);
  portal = new PortalAccessService({
    tokens: store.portalTokens,
    clients: fakeClientDirectory(clients),
    branding: whiteLabel,
    clientUsers: store.clientUsers,
    accountActive: async (id) => active.has(id),
    now: () => now,
  });
  users = new ClientUserService(store.clientUsers, fakeClientDirectory(clients), portal);
});

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof AgencyOperationError ? e.reason : String(e);
  }
  return "resolved";
};

describe("portal tokens", () => {
  it("are 32 random bytes behind the prefix, and only their hash is stored", async () => {
    const a = await portal.issueClientLink(OWNER, CLIENT_A);
    const b = await portal.issueClientLink(OWNER, CLIENT_A);
    expect(a.token.startsWith(PORTAL_TOKEN_PREFIX)).toBe(true);
    expect(Buffer.from(a.token.slice(PORTAL_TOKEN_PREFIX.length), "base64url")).toHaveLength(32);
    expect(isPortalTokenShape(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
    for (const row of store.tokens) {
      expect(JSON.stringify(row)).not.toContain(a.token.slice(PORTAL_TOKEN_PREFIX.length));
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(store.tokens[0]!.tokenHash).toBe(hashPortalToken(a.token));
  });

  it("compares digests in constant time and refuses unequal or empty ones", () => {
    const h = hashPortalToken("x");
    expect(sameDigest(h, h)).toBe(true);
    expect(sameDigest(h, hashPortalToken("y"))).toBe(false);
    expect(sameDigest(h, h.slice(0, 62))).toBe(false);
    expect(sameDigest("", "")).toBe(false);
  });

  it("verifies to its own client, with sections from the client's switches", async () => {
    const { token } = await portal.issueClientLink(OWNER, CLIENT_A);
    expect(await portal.verify(token)).toMatchObject({ ownerId: OWNER, clientId: CLIENT_A, clientUserId: null, sections: ["analytics", "recordings", "heatmaps"] });
    clients[0]!.featuresEnabled.replays = false;
    expect((await portal.verify(token))!.sections).toEqual(["analytics", "heatmaps"]);
    expect(sectionsForFeatures({ analytics: false, heatmaps: false, replays: false })).toEqual([]);
  });

  it("refuses malformed, unknown and tampered tokens alike", async () => {
    const { token } = await portal.issueClientLink(OWNER, CLIENT_A);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    for (const bad of [undefined, "", "scp_short", token.slice(PORTAL_TOKEN_PREFIX.length), `${token}x`, flipped, "eyJhbGciOiJIUzI1NiJ9.e30.x"]) {
      expect(await portal.verify(bad)).toBeNull();
    }
  });

  it("expires: the anonymous link after 7 days, a client user's after 30", async () => {
    const anon = await portal.issueClientLink(OWNER, CLIENT_A);
    const invited = await users.invite(OWNER, { clientId: CLIENT_A, email: "jane@a.co", name: "Jane" });
    expect(anon.record.expiresAt.getTime() - now.getTime()).toBe(PORTAL_LINK_TTL_DAYS * DAY);
    expect(invited.link.record.expiresAt.getTime() - now.getTime()).toBe(CLIENT_USER_LINK_TTL_DAYS * DAY);
    now = new Date(now.getTime() + PORTAL_LINK_TTL_DAYS * DAY);
    expect(await portal.verify(anon.token)).toBeNull();
    expect(await portal.verify(invited.link.token)).not.toBeNull();
    now = new Date(now.getTime() + CLIENT_USER_LINK_TTL_DAYS * DAY);
    expect(await portal.verify(invited.link.token)).toBeNull();
  });

  it("generating a link replaces the previous anonymous one, but not users' links", async () => {
    const first = await portal.issueClientLink(OWNER, CLIENT_A);
    const user = await users.invite(OWNER, { clientId: CLIENT_A, email: "jane@a.co", name: "" });
    const second = await portal.issueClientLink(OWNER, CLIENT_A);
    expect(await portal.verify(first.token)).toBeNull();
    expect(await portal.verify(second.token)).not.toBeNull();
    expect(await portal.verify(user.link.token)).not.toBeNull();
    expect(await portal.revokeClientLinks(OWNER, CLIENT_A)).toBe(true);
    expect(await portal.verify(second.token)).toBeNull();
    expect(await portal.verify(user.link.token)).not.toBeNull();
  });

  it("will not issue or revoke for a client the owner does not have", async () => {
    expect(await refusal(portal.issueClientLink(OWNER, FOREIGN))).toBe("client_not_found");
    expect(await refusal(portal.issueClientLink(OWNER, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"))).toBe("client_not_found");
    expect(await portal.revokeClientLinks(OWNER, FOREIGN)).toBe(false);
    expect(store.tokens).toHaveLength(0);
  });

  it("stops working while the client is suspended or archived, and again when active", async () => {
    const { token } = await portal.issueClientLink(OWNER, CLIENT_A);
    for (const status of ["suspended", "archived"]) {
      clients[0]!.status = status;
      expect(await portal.verify(token)).toBeNull();
    }
    clients[0]!.status = "active";
    expect(await portal.verify(token)).not.toBeNull();
  });

  it("stops working when the owner's account is disabled", async () => {
    const { token } = await portal.issueClientLink(OWNER, CLIENT_A);
    active.delete(OWNER);
    expect(await portal.verify(token)).toBeNull();
    expect(await portal.open(token)).toBeNull();
  });

  it("dies if its client stops being the owner's", async () => {
    const { token } = await portal.issueClientLink(OWNER, CLIENT_A);
    clients[0]!.ownerId = OTHER_OWNER;
    expect(await portal.verify(token)).toBeNull();
  });

  it("refuses a user token whose user row disagrees on owner or client", async () => {
    const { link, clientUser } = await users.invite(OWNER, { clientId: CLIENT_A, email: "jane@a.co", name: "" });
    store.users.get(clientUser.id)!.clientId = CLIENT_B;
    expect(await portal.verify(link.token)).toBeNull();
  });

  it("opens to the client's own websites and the owner's brand, and records the visit", async () => {
    await whiteLabel.update(OWNER, { brandName: "Northwind", hideSeentics: true });
    const { link, clientUser } = await users.invite(OWNER, { clientId: CLIENT_A, email: "Jane@A.co", name: "Jane" });
    // A site that is somehow listed but is not this owner's is never shown.
    clients[0]!.websites.push({ id: "stray", ownerId: OTHER_OWNER, clientId: CLIENT_A, name: "Stray", url: "stray.example" });
    const session = await portal.open(link.token);
    expect(session).toMatchObject({
      client: { id: CLIENT_A, name: "Client A", company: "A Co", status: "active" },
      websites: [{ id: "site-a", name: "A shop", url: "a.shop" }],
      brand: { brand_name: "Northwind", hide_seentics: true, primary_color: "#6366f1" },
      clientUser: { name: "Jane", email: "jane@a.co" },
    });
    expect(session!.websites).toHaveLength(1);
    const user = await users.get(OWNER, clientUser.id);
    expect(user!.status).toBe("active");
    expect(user!.lastSeenAt).toEqual(now);
  });
});

describe("client users", () => {
  it("invites to the owner's own client only, once per email", async () => {
    const { clientUser, link } = await users.invite(OWNER, { clientId: CLIENT_A, email: "Jane@A.co", name: "Jane" });
    expect(clientUser).toMatchObject({ clientId: CLIENT_A, email: "jane@a.co", status: "invited", linkExpiresAt: link.record.expiresAt });
    expect(link.record).toMatchObject({ ownerId: OWNER, clientId: CLIENT_A, clientUserId: clientUser.id });
    expect(await refusal(users.invite(OWNER, { clientId: CLIENT_A, email: "JANE@a.co", name: "" }))).toBe("client_user_exists");
    expect(await refusal(users.invite(OWNER, { clientId: FOREIGN, email: "x@y.z", name: "" }))).toBe("client_not_found");
    // The same person may be invited to another client.
    expect((await users.invite(OWNER, { clientId: CLIENT_B, email: "jane@a.co", name: "" })).clientUser.clientId).toBe(CLIENT_B);
  });

  it("lists per owner and per client; another owner sees none of them", async () => {
    await users.invite(OWNER, { clientId: CLIENT_A, email: "a@a.co", name: "" });
    await users.invite(OWNER, { clientId: CLIENT_B, email: "b@b.co", name: "" });
    expect((await users.list(OWNER, {})).map((u) => u.email).sort()).toEqual(["a@a.co", "b@b.co"]);
    expect((await users.list(OWNER, { clientId: CLIENT_B })).map((u) => u.email)).toEqual(["b@b.co"]);
    expect(await users.list(OTHER_OWNER, {})).toEqual([]);
    const id = (await users.list(OWNER, {}))[0]!.id;
    expect(await users.get(OTHER_OWNER, id)).toBeNull();
    expect(await refusal(users.revoke(OTHER_OWNER, id))).toBe("client_user_not_found");
    expect(await refusal(users.resend(OTHER_OWNER, id))).toBe("client_user_not_found");
    expect(await users.remove(OTHER_OWNER, id)).toBe(false);
  });

  it("resend makes a new link and kills the old one", async () => {
    const { clientUser, link } = await users.invite(OWNER, { clientId: CLIENT_A, email: "a@a.co", name: "" });
    const again = await users.resend(OWNER, clientUser.id);
    expect(again.link.token).not.toBe(link.token);
    expect(await portal.verify(link.token)).toBeNull();
    expect(await portal.verify(again.link.token)).toMatchObject({ clientUserId: clientUser.id });
  });

  it("revoke takes effect on the very next check, and a revoked user cannot be resent to", async () => {
    const { clientUser, link } = await users.invite(OWNER, { clientId: CLIENT_A, email: "a@a.co", name: "" });
    expect(await portal.verify(link.token)).not.toBeNull();
    const revoked = await users.revoke(OWNER, clientUser.id);
    expect(revoked).toMatchObject({ status: "revoked", linkExpiresAt: null });
    expect(await portal.verify(link.token)).toBeNull();
    expect(await refusal(users.resend(OWNER, clientUser.id))).toBe("client_user_revoked");
  });

  it("delete takes the user's links with it", async () => {
    const { clientUser, link } = await users.invite(OWNER, { clientId: CLIENT_A, email: "a@a.co", name: "" });
    expect(await users.remove(OWNER, clientUser.id)).toBe(true);
    expect(await portal.verify(link.token)).toBeNull();
    expect(store.tokens).toHaveLength(0);
    expect(await users.remove(OWNER, clientUser.id)).toBe(false);
  });
});

describe("white label", () => {
  it("reads defaults until saved, then merges patches", async () => {
    expect(await whiteLabel.get(OWNER)).toMatchObject({ brandName: "", primaryColor: "#6366f1", hideSeentics: false, updatedAt: null });
    await whiteLabel.update(OWNER, { brandName: "Northwind", primaryColor: "#112233" });
    const saved = await whiteLabel.update(OWNER, { supportEmail: "help@nw.example", brandName: undefined });
    expect(saved).toMatchObject({ ownerId: OWNER, brandName: "Northwind", primaryColor: "#112233", supportEmail: "help@nw.example" });
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect((await whiteLabel.get(OTHER_OWNER)).brandName).toBe("");
  });

  it("gives clients the brand without the owner id", async () => {
    await whiteLabel.update(OWNER, { brandName: "Northwind" });
    const brand = await whiteLabel.brandFor(OWNER);
    expect(Object.keys(brand).sort()).toEqual(["brand_name", "footer_text", "hide_seentics", "logo_url", "primary_color", "support_email"]);
    expect(brand.brand_name).toBe("Northwind");
  });
});
