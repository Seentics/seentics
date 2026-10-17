import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger, queueRows, resetDb, sqlCalls } from "../../../app/tests/helpers/fake-db";

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);

let repos: {
  whiteLabel: import("../interfaces").WhiteLabelRepository;
  clientUsers: import("../interfaces").ClientUserRepository;
  tokens: import("../interfaces").PortalTokenRepository;
};

beforeAll(async () => {
  repos = {
    whiteLabel: new (await import("../repositories/white-label.repository")).PostgresWhiteLabelRepository(),
    clientUsers: new (await import("../repositories/client-user.repository")).PostgresClientUserRepository(),
    tokens: new (await import("../repositories/portal-token.repository")).PostgresPortalTokenRepository(),
  };
});

beforeEach(resetDb);

const OWNER = "99999999-9999-4999-8999-999999999999";
const CLIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER = "11111111-1111-4111-8111-111111111111";
const HASH = "ab".repeat(32);
const squash = (s: string) => s.replace(/\s+/g, " ");

describe("client users repository", () => {
  it("scopes every statement to the owner", async () => {
    await repos.clientUsers.list(OWNER, {});
    await repos.clientUsers.findById(OWNER, USER);
    await repos.clientUsers.setStatus(OWNER, USER, "revoked");
    await repos.clientUsers.delete(OWNER, USER);
    expect(sqlCalls).toHaveLength(4);
    for (const call of sqlCalls) {
      expect(squash(call.text)).toContain("owner_id = ?::uuid");
      expect(call.values).toContain(OWNER);
    }
  });

  it("filters by client only when asked, in one statement", async () => {
    await repos.clientUsers.list(OWNER, { clientId: CLIENT });
    await repos.clientUsers.list(OWNER, {});
    expect(sqlCalls[0]!.values).toEqual([OWNER, CLIENT, CLIENT]);
    expect(sqlCalls[1]!.values).toEqual([OWNER, null, null]);
  });

  it("lower-cases the email and reports a duplicate as null", async () => {
    queueRows([]);
    expect(await repos.clientUsers.insert(OWNER, { clientId: CLIENT, email: "Jane@A.co", name: "Jane" })).toBeNull();
    expect(squash(sqlCalls[0]!.text)).toContain("ON CONFLICT (client_id, email) DO NOTHING");
    expect(sqlCalls[0]!.values).toEqual([OWNER, CLIENT, "jane@a.co", "Jane"]);
  });

  it("maps rows, string timestamps included", async () => {
    queueRows([{
      id: USER, owner_id: OWNER, client_id: CLIENT, email: "j@a.co", name: "J", status: "active",
      created_at: "2026-10-01T00:00:00.000Z", updated_at: "2026-10-02T00:00:00.000Z",
      last_seen_at: null, link_expires_at: "2026-11-01T00:00:00.000Z",
    }]);
    const u = await repos.clientUsers.findById(OWNER, USER);
    expect(u).toMatchObject({ id: USER, ownerId: OWNER, clientId: CLIENT, status: "active", lastSeenAt: null });
    expect(u!.createdAt).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(u!.linkExpiresAt).toEqual(new Date("2026-11-01T00:00:00.000Z"));
  });
});

describe("portal tokens repository", () => {
  it("stores the hash it is given and nothing else", async () => {
    const expiresAt = new Date("2026-10-24T00:00:00.000Z");
    queueRows([{ id: "t1", owner_id: OWNER, client_id: CLIENT, client_user_id: null, token_hash: HASH, expires_at: expiresAt.toISOString(), created_at: "2026-10-17T00:00:00.000Z" }]);
    const rec = await repos.tokens.insert({ ownerId: OWNER, clientId: CLIENT, clientUserId: null, tokenHash: HASH, expiresAt });
    expect(sqlCalls[0]!.values).toEqual([OWNER, CLIENT, null, HASH, expiresAt.toISOString()]);
    expect(squash(sqlCalls[0]!.text)).toContain("(owner_id, client_id, client_user_id, token_hash, expires_at)");
    expect(rec.expiresAt).toEqual(expiresAt);
  });

  it("finds only live tokens of live users that agree on owner and client", async () => {
    await repos.tokens.findLiveByHash(HASH);
    const text = squash(sqlCalls[0]!.text);
    for (const clause of [
      "t.token_hash = ?",
      "t.revoked_at IS NULL",
      "t.expires_at > NOW()",
      "u.status <> 'revoked'",
      "u.owner_id = t.owner_id",
      "u.client_id = t.client_id",
    ]) expect(text).toContain(clause);
    expect(sqlCalls[0]!.values).toEqual([HASH]);
  });

  it("revokes by owner: a user's tokens, or a client's anonymous links only", async () => {
    queueRows([{ id: "a" }, { id: "b" }], [{ id: "c" }]);
    expect(await repos.tokens.revokeForClientUser(OWNER, USER)).toBe(2);
    expect(await repos.tokens.revokeClientLinks(OWNER, CLIENT)).toBe(1);
    expect(sqlCalls[0]!.values).toEqual([OWNER, USER]);
    expect(squash(sqlCalls[1]!.text)).toContain("client_user_id IS NULL");
    expect(sqlCalls[1]!.values).toEqual([OWNER, CLIENT]);
  });

  it("first use activates an invited user, and never un-revokes one", async () => {
    await repos.tokens.markUsed("t1", USER);
    await repos.tokens.markUsed("t2", null);
    expect(sqlCalls).toHaveLength(3);
    const userUpdate = squash(sqlCalls[1]!.text);
    expect(userUpdate).toContain("CASE WHEN status = 'invited' THEN 'active' ELSE status END");
    expect(userUpdate).toContain("status <> 'revoked'");
  });
});

describe("white label repository", () => {
  it("upserts one row per owner and maps it back", async () => {
    const row = {
      owner_id: OWNER, brand_name: "NW", logo_url: "", primary_color: "#112233", support_email: "",
      footer_text: "", hide_seentics: true, updated_at: "2026-10-17T00:00:00.000Z",
    };
    queueRows([row], [row]);
    const saved = await repos.whiteLabel.upsert({
      ownerId: OWNER, brandName: "NW", logoUrl: "", primaryColor: "#112233", supportEmail: "",
      footerText: "", hideSeentics: true, updatedAt: null,
    });
    expect(squash(sqlCalls[0]!.text)).toContain("ON CONFLICT (owner_id) DO UPDATE");
    expect(sqlCalls[0]!.values[0]).toBe(OWNER);
    expect(saved).toMatchObject({ ownerId: OWNER, brandName: "NW", hideSeentics: true });
    expect(saved.updatedAt).toEqual(new Date("2026-10-17T00:00:00.000Z"));
    expect(await repos.whiteLabel.find(OWNER)).toMatchObject({ primaryColor: "#112233" });
    expect(sqlCalls[1]!.values).toEqual([OWNER]);
  });
});
