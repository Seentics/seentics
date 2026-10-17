import { describe, expect, it } from "bun:test";
import * as jose from "jose";
import { addMember, api, seedUser, seedWebsite, sql, type SeededUser } from "./harness";
import { fileUnderClient, seedClient } from "./helpers/identity";
import { W } from "./helpers/websites";
import { PostgresWebsiteRepository } from "../modules/websites/repositories/postgres-website.repository";

/**
 * Client sign-in (agency workspace, phase 2) on Core's side: the client-member arm of
 * `findRole`, the website list a client user sees, and the header narrowing on top.
 */

const repo = new PostgresWebsiteRepository();
const goal = { name: "Signed up", type: "pageview", identifier: "/thanks" };

/** The access token the gateway's client sign-in issues: `kind: client`, `agency: <owner>`. */
async function clientToken(userId: string, agencyId: string): Promise<string> {
  return new jose.SignJWT({ user_id: userId, kind: "client", agency: agencyId, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
}

async function setFeatures(clientId: string, features: Record<string, string>) {
  await sql`UPDATE clients SET dashboard_features = ${JSON.stringify(features)}::jsonb WHERE id = ${clientId}::uuid`;
}

async function addClientMember(clientId: string, userId: string, ownerId: string, status = "active") {
  await sql`INSERT INTO client_members (client_id, user_id, owner_id, status)
            VALUES (${clientId}::uuid, ${userId}::uuid, ${ownerId}::uuid, ${status})`;
}

/** An agency with one client, one site filed under it, and a client user who is a member. */
async function seedAgencyClient(features: Record<string, string> = { overview: "view" }) {
  const [agency, user] = await Promise.all([seedUser(), seedUser()]);
  const clientId = await seedClient(agency.id);
  await setFeatures(clientId, features);
  const site = await seedWebsite(agency.id);
  await fileUnderClient(site.id, clientId);
  await addClientMember(clientId, user.id, agency.id);
  return { agency, user, clientId, site, token: await clientToken(user.id, agency.id) };
}

describe("findRole: the client-member arm", () => {
  it("makes a member of a view-only client a viewer", async () => {
    const a = await seedAgencyClient({ overview: "view", revenue: "view" });
    expect(await repo.findRole(a.site.id, a.user.id)).toBe("viewer");
  });

  it("makes a member a member once any page is editable, and never more", async () => {
    const a = await seedAgencyClient({ overview: "view", funnels: "edit" });
    expect(await repo.findRole(a.site.id, a.user.id)).toBe("member");
    await setFeatures(a.clientId, Object.fromEntries(["overview", "funnels", "goals", "privacy"].map((f) => [f, "edit"])));
    expect(await repo.findRole(a.site.id, a.user.id)).toBe("member");
  });

  it("counts an invited member, and refuses a disabled one", async () => {
    const a = await seedAgencyClient();
    await sql`UPDATE client_members SET status = 'invited' WHERE user_id = ${a.user.id}::uuid`;
    expect(await repo.findRole(a.site.id, a.user.id)).toBe("viewer");
    await sql`UPDATE client_members SET status = 'disabled' WHERE user_id = ${a.user.id}::uuid`;
    expect(await repo.findRole(a.site.id, a.user.id)).toBeNull();
  });

  it("refuses the client's sites once the client is suspended or archived", async () => {
    const a = await seedAgencyClient();
    for (const status of ["suspended", "archived"]) {
      await sql`UPDATE clients SET status = ${status} WHERE id = ${a.clientId}::uuid`;
      expect(await repo.findRole(a.site.id, a.user.id)).toBeNull();
    }
  });

  it("gives nothing on another client's site, an unfiled site, or another agency's site", async () => {
    const a = await seedAgencyClient();
    const otherClient = await seedClient(a.agency.id);
    const otherClientSite = await seedWebsite(a.agency.id);
    await fileUnderClient(otherClientSite.id, otherClient);
    const unfiled = await seedWebsite(a.agency.id);
    const b = await seedAgencyClient();
    expect(await repo.findRole(otherClientSite.id, a.user.id)).toBeNull();
    expect(await repo.findRole(unfiled.id, a.user.id)).toBeNull();
    expect(await repo.findRole(b.site.id, a.user.id)).toBeNull();
  });

  it("refuses a membership row whose owner is not the agency that owns the site", async () => {
    const a = await seedAgencyClient();
    const elsewhere = await seedUser();
    const forged = await seedUser();
    await addClientMember(a.clientId, forged.id, elsewhere.id);
    expect(await repo.findRole(a.site.id, forged.id)).toBeNull();
  });

  it("takes the higher of a website role and the client role", async () => {
    const a = await seedAgencyClient({ overview: "view" });
    await addMember(a.site.id, a.user.id, "admin");
    expect(await repo.findRole(a.site.id, a.user.id)).toBe("admin");

    const b = await seedAgencyClient({ overview: "edit" });
    await addMember(b.site.id, b.user.id, "viewer");
    expect(await repo.findRole(b.site.id, b.user.id)).toBe("member");
  });
});

describe("a client user on the website routes", () => {
  it("opens the site but no owner or admin route", async () => {
    const a = await seedAgencyClient({ overview: "edit" });
    const headers = { "X-Team-Permissions": "analytics:overview.view,analytics:overview.manage" };
    expect((await api("GET", `${W}/${a.site.id}`, { token: a.token, headers })).status).toBe(200);
    expect((await api("PUT", `${W}/${a.site.id}`, { token: a.token, headers, body: { name: "x" } })).status).toBe(403);
    expect((await api("DELETE", `${W}/${a.site.id}`, { token: a.token, headers })).status).toBe(403);
    const other = await seedUser();
    expect((await api("POST", `${W}/${a.site.id}/members`, { token: a.token, headers, body: { email: other.email } })).status).toBe(403);
    expect((await api("POST", W, { token: a.token, headers, body: { name: "Mine", url: "https://mine.example" } })).status).toBe(403);
  });

  it("is narrowed by its features the way a team role is", async () => {
    const a = await seedAgencyClient({ overview: "edit", goals: "view" });
    const viewGoals = { "X-Team-Permissions": "analytics:overview.view,analytics:overview.manage,analytics:goals.view" };
    expect((await api("GET", `${W}/${a.site.id}/goals`, { token: a.token, headers: viewGoals })).status).toBe(200);
    expect((await api("POST", `${W}/${a.site.id}/goals`, { token: a.token, headers: viewGoals, body: goal })).status).toBe(403);

    await setFeatures(a.clientId, { goals: "edit" });
    const editGoals = { "X-Team-Permissions": "analytics:goals.view,analytics:goals.manage" };
    expect((await api("POST", `${W}/${a.site.id}/goals`, { token: a.token, headers: editGoals, body: goal })).status).toBe(201);
  });

  it("cannot manage on a view-only client whatever the header claims", async () => {
    const a = await seedAgencyClient({ goals: "view" });
    const claims = { "X-Team-Permissions": "analytics:goals.view,analytics:goals.manage,analytics:settings.manage" };
    expect((await api("POST", `${W}/${a.site.id}/goals`, { token: a.token, headers: claims, body: goal })).status).toBe(403);
  });

  it("loses the site with its membership", async () => {
    const a = await seedAgencyClient();
    const headers = { "X-Team-Permissions": "analytics:overview.view" };
    await sql`UPDATE client_members SET status = 'disabled' WHERE user_id = ${a.user.id}::uuid`;
    expect((await api("GET", `${W}/${a.site.id}`, { token: a.token, headers })).status).toBe(403);
  });
});

describe("GET /user/websites for a client user", () => {
  const ids = (body: { data: { id: string }[] }) => body.data.map((w) => w.id).sort();

  async function scenario() {
    const a = await seedAgencyClient();
    // A second client of the same agency the user also belongs to, a client they do not,
    // a disabled membership, a suspended client, and the same user's standing elsewhere.
    const second = await seedClient(a.agency.id);
    const secondSite = await seedWebsite(a.agency.id);
    await fileUnderClient(secondSite.id, second);
    await addClientMember(second, a.user.id, a.agency.id);

    const notMine = await seedClient(a.agency.id);
    const notMineSite = await seedWebsite(a.agency.id);
    await fileUnderClient(notMineSite.id, notMine);

    const disabled = await seedClient(a.agency.id);
    const disabledSite = await seedWebsite(a.agency.id);
    await fileUnderClient(disabledSite.id, disabled);
    await addClientMember(disabled, a.user.id, a.agency.id, "disabled");

    const suspended = await seedClient(a.agency.id, { status: "suspended" });
    const suspendedSite = await seedWebsite(a.agency.id);
    await fileUnderClient(suspendedSite.id, suspended);
    await addClientMember(suspended, a.user.id, a.agency.id);

    const unfiled = await seedWebsite(a.agency.id);
    const owned = await seedWebsite(a.user.id);
    const invitedBy: SeededUser = await seedUser();
    const invited = await seedWebsite(invitedBy.id);
    await addMember(invited.id, a.user.id, "viewer");

    const b = await seedAgencyClient();
    const otherAgencyClient = await seedClient(b.agency.id);
    const otherAgencySite = await seedWebsite(b.agency.id);
    await fileUnderClient(otherAgencySite.id, otherAgencyClient);
    await addClientMember(otherAgencyClient, a.user.id, b.agency.id);

    return { a, secondSite, unfiled, owned, invited, otherAgencySite };
  }

  it("lists only that agency's client sites the user is an active member of", async () => {
    const s = await scenario();
    const res = await api("GET", "/api/v1/user/websites", { token: s.a.token });
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([s.a.site.id, s.secondSite.id].sort());
  });

  it("scopes by the gateway's X-Client-Agency too", async () => {
    const s = await scenario();
    const account = await seedUser();
    // The same user's account session behind the gateway, signed in to the agency.
    const { signAccessToken } = await import("../platform/security/auth-jwt");
    const token = await signAccessToken(s.a.user.id);
    const res = await api("GET", "/api/v1/user/websites", { token, headers: { "X-Client-Agency": s.a.agency.id } });
    expect(ids(res.body)).toEqual([s.a.site.id, s.secondSite.id].sort());
    expect((await api("GET", "/api/v1/user/websites", { token: account.token, headers: { "X-Client-Agency": s.a.agency.id } })).body.data).toEqual([]);
  });

  it("gives an account its own, invited and client sites", async () => {
    const s = await scenario();
    const { signAccessToken } = await import("../platform/security/auth-jwt");
    const res = await api("GET", "/api/v1/user/websites", { token: await signAccessToken(s.a.user.id) });
    expect(ids(res.body)).toEqual([s.a.site.id, s.secondSite.id, s.owned.id, s.invited.id, s.otherAgencySite.id].sort());
  });

  it("refuses a client token without its agency", async () => {
    const user = await seedUser();
    const token = await new jose.SignJWT({ user_id: user.id, kind: "client" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    expect((await api("GET", "/api/v1/user/websites", { token })).status).toBe(401);
  });
});
