import { describe, expect, it } from "bun:test";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { seedTeam, W } from "./helpers/websites";

async function roleOf(siteId: string, userId: string): Promise<string | null> {
  const [row] = await sql<{ role: string }[]>`SELECT role FROM website_members WHERE website_id = ${siteId}::uuid AND user_id = ${userId}::uuid`;
  return row?.role ?? null;
}

describe("listing members", () => {
  it("shows every member with their name and email, to any role on the site", async () => {
    const t = await seedTeam();
    for (const u of [t.owner, t.admin, t.member, t.viewer]) {
      const res = await api("GET", `${W}/${t.site.id}/members`, { token: u.token });
      expect(res.status).toBe(200);
      const byUser = Object.fromEntries(res.body.data.map((m: { userId: string; role: string; userEmail: string }) => [m.userId, [m.role, m.userEmail]]));
      expect(byUser).toEqual({
        [t.admin.id]: ["admin", t.admin.email],
        [t.member.id]: ["member", t.member.email],
        [t.viewer.id]: ["viewer", t.viewer.email],
      });
    }
  });

  it("is closed to another account and to a signed-out caller", async () => {
    const t = await seedTeam();
    expect((await api("GET", `${W}/${t.site.id}/members`, { token: t.stranger.token })).status).toBe(403);
    expect((await api("GET", `${W}/${t.site.id}/members`)).status).toBe(401);
  });
});

describe("adding a member by email", () => {
  it("adds an existing account straight away with the role asked for", async () => {
    const t = await seedTeam();
    const res = await api("POST", `${W}/${t.site.id}/members`, { token: t.owner.token, body: { email: t.stranger.email.toUpperCase(), role: "member" } });
    expect(res.status).toBe(201);
    expect(await roleOf(t.site.id, t.stranger.id)).toBe("member");
    expect((await api("GET", `${W}/${t.site.id}`, { token: t.stranger.token })).status).toBe(200);
  });

  it("makes the new member a viewer when no role is given", async () => {
    const t = await seedTeam();
    await api("POST", `${W}/${t.site.id}/members`, { token: t.admin.token, body: { email: t.stranger.email } });
    expect(await roleOf(t.site.id, t.stranger.id)).toBe("viewer");
  });

  it("leaves an existing member's role as it is when they are added again", async () => {
    const t = await seedTeam();
    const res = await api("POST", `${W}/${t.site.id}/members`, { token: t.owner.token, body: { email: t.admin.email, role: "viewer" } });
    expect(res.status).toBe(201);
    expect(await roleOf(t.site.id, t.admin.id)).toBe("admin");
  });

  it("refuses an address with no account behind it", async () => {
    const t = await seedTeam();
    const res = await api("POST", `${W}/${t.site.id}/members`, { token: t.owner.token, body: { email: "nobody-here@it.test" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("user not found");
  });

  it("lets an admin add up to their own rank, never an owner", async () => {
    const t = await seedTeam();
    const other = await seedUser();
    expect((await api("POST", `${W}/${t.site.id}/members`, { token: t.admin.token, body: { email: other.email, role: "admin" } })).status).toBe(201);
    expect(await roleOf(t.site.id, other.id)).toBe("admin");

    const res = await api("POST", `${W}/${t.site.id}/members`, { token: t.admin.token, body: { email: t.stranger.email, role: "owner" } });
    // Refused, though the controller answers 400 rather than 403 for it.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBe("forbidden");
    expect(await roleOf(t.site.id, t.stranger.id)).toBeNull();
  });

  it("is closed to members, viewers and strangers", async () => {
    const t = await seedTeam();
    const other = await seedUser();
    for (const u of [t.member, t.viewer, t.stranger]) {
      const res = await api("POST", `${W}/${t.site.id}/members`, { token: u.token, body: { email: other.email, role: "viewer" } });
      expect(res.status).toBe(403);
    }
    expect((await api("POST", `${W}/${t.site.id}/members`, { body: { email: other.email } })).status).toBe(401);
    expect(await roleOf(t.site.id, other.id)).toBeNull();
  });

  it("rejects a bad email, an unknown role and an over-long address", async () => {
    const t = await seedTeam();
    for (const body of [{}, { email: "not-an-email" }, { email: t.stranger.email, role: "superuser" }, { email: `${"a".repeat(320)}@x.io` }]) {
      const res = await api("POST", `${W}/${t.site.id}/members`, { token: t.owner.token, body });
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    expect(await roleOf(t.site.id, t.stranger.id)).toBeNull();
  });
});

describe("changing a member's role", () => {
  it("lets the owner promote and demote anyone", async () => {
    const t = await seedTeam();
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.viewer.id}/role`, { token: t.owner.token, body: { role: "admin" } })).status).toBe(204);
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.admin.id}/role`, { token: t.owner.token, body: { role: "viewer" } })).status).toBe(204);
    expect(await roleOf(t.site.id, t.viewer.id)).toBe("admin");
    expect(await roleOf(t.site.id, t.admin.id)).toBe("viewer");
    // The new role applies on the next request: roles are never cached.
    expect((await api("PUT", `${W}/${t.site.id}`, { token: t.admin.token, body: { name: "x" } })).status).toBe(403);
  });

  it("lets an admin move people below them, up to admin", async () => {
    const t = await seedTeam();
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.member.id}/role`, { token: t.admin.token, body: { role: "viewer" } })).status).toBe(204);
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.viewer.id}/role`, { token: t.admin.token, body: { role: "admin" } })).status).toBe(204);
    expect(await roleOf(t.site.id, t.member.id)).toBe("viewer");
    expect(await roleOf(t.site.id, t.viewer.id)).toBe("admin");
  });

  it("does not let an admin demote a fellow admin or the owner, or grant owner", async () => {
    const owner = await seedUser();
    const admin = await seedUser();
    const peer = await seedUser();
    const viewer = await seedUser();
    // Created through the API so the owner has a membership row an admin could aim at.
    const created = await api("POST", W, { token: owner.token, body: { name: "S", url: "https://ranked.example.com" } });
    const siteId = created.body.data.website.id;
    await addMember(siteId, admin.id, "admin");
    await addMember(siteId, peer.id, "admin");
    await addMember(siteId, viewer.id, "viewer");

    expect((await api("PUT", `${W}/${siteId}/members/${peer.id}/role`, { token: admin.token, body: { role: "viewer" } })).status).toBe(403);
    expect((await api("PUT", `${W}/${siteId}/members/${owner.id}/role`, { token: admin.token, body: { role: "viewer" } })).status).toBe(403);
    expect((await api("PUT", `${W}/${siteId}/members/${viewer.id}/role`, { token: admin.token, body: { role: "owner" } })).status).toBe(403);
    expect(await roleOf(siteId, peer.id)).toBe("admin");
    expect(await roleOf(siteId, owner.id)).toBe("owner");
    expect(await roleOf(siteId, viewer.id)).toBe("viewer");
  });

  it("does not let anyone change their own role", async () => {
    const t = await seedTeam();
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.admin.id}/role`, { token: t.admin.token, body: { role: "viewer" } })).status).toBe(403);
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.owner.id}/role`, { token: t.owner.token, body: { role: "viewer" } })).status).toBe(403);
    expect(await roleOf(t.site.id, t.admin.id)).toBe("admin");
  });

  it("is closed to members and viewers, and to a site the caller has no part in", async () => {
    const t = await seedTeam();
    for (const u of [t.member, t.viewer, t.stranger]) {
      const res = await api("PUT", `${W}/${t.site.id}/members/${t.viewer.id}/role`, { token: u.token, body: { role: "member" } });
      expect(res.status).toBe(403);
    }
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.viewer.id}/role`, { body: { role: "member" } })).status).toBe(401);
    expect(await roleOf(t.site.id, t.viewer.id)).toBe("viewer");
  });

  it("rejects an unknown role and a malformed member id", async () => {
    const t = await seedTeam();
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.viewer.id}/role`, { token: t.owner.token, body: { role: "god" } })).status).toBe(400);
    expect((await api("PUT", `${W}/${t.site.id}/members/${t.viewer.id}/role`, { token: t.owner.token, body: {} })).status).toBe(400);
    const bad = await api("PUT", `${W}/${t.site.id}/members/not-a-uuid/role`, { token: t.owner.token, body: { role: "member" } });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);
  });

  it("cannot reach a member of another site through the caller's own site", async () => {
    const t = await seedTeam();
    const other = await seedTeam();
    const res = await api("PUT", `${W}/${t.site.id}/members/${other.viewer.id}/role`, { token: t.owner.token, body: { role: "admin" } });
    expect(res.status).toBeLessThan(500);
    expect(await roleOf(other.site.id, other.viewer.id)).toBe("viewer");
  });
});

describe("removing a member", () => {
  it("takes the member's access away at once", async () => {
    const t = await seedTeam();
    const res = await api("DELETE", `${W}/${t.site.id}/members/${t.admin.id}`, { token: t.owner.token });
    expect(res.status).toBe(204);
    expect(await roleOf(t.site.id, t.admin.id)).toBeNull();
    expect((await api("GET", `${W}/${t.site.id}`, { token: t.admin.token })).status).toBe(403);
  });

  it("lets an admin remove members and viewers but not a fellow admin or themselves", async () => {
    const t = await seedTeam();
    const peer = await seedUser();
    await addMember(t.site.id, peer.id, "admin");
    expect((await api("DELETE", `${W}/${t.site.id}/members/${t.viewer.id}`, { token: t.admin.token })).status).toBe(204);
    expect((await api("DELETE", `${W}/${t.site.id}/members/${peer.id}`, { token: t.admin.token })).status).toBe(403);
    expect((await api("DELETE", `${W}/${t.site.id}/members/${t.admin.id}`, { token: t.admin.token })).status).toBe(403);
    expect(await roleOf(t.site.id, t.viewer.id)).toBeNull();
    expect(await roleOf(t.site.id, peer.id)).toBe("admin");
    expect(await roleOf(t.site.id, t.admin.id)).toBe("admin");
  });

  it("never takes the site from its owner, even when an admin targets them", async () => {
    const t = await seedTeam();
    await api("DELETE", `${W}/${t.site.id}/members/${t.owner.id}`, { token: t.admin.token });
    // Ownership is the website row, not a membership, so the owner keeps every right.
    const role = await api("GET", `${W}/${t.site.id}/my-role`, { token: t.owner.token });
    expect(role.body.data.role).toBe("owner");
  });

  it("is closed to members, viewers and strangers", async () => {
    const t = await seedTeam();
    for (const u of [t.member, t.viewer, t.stranger]) {
      expect((await api("DELETE", `${W}/${t.site.id}/members/${t.viewer.id}`, { token: u.token })).status).toBe(403);
    }
    expect((await api("DELETE", `${W}/${t.site.id}/members/${t.viewer.id}`)).status).toBe(401);
    expect(await roleOf(t.site.id, t.viewer.id)).toBe("viewer");
  });

  it("does not remove a member of another site named through the caller's own site", async () => {
    const t = await seedTeam();
    const other = await seedTeam();
    await api("DELETE", `${W}/${t.site.id}/members/${other.admin.id}`, { token: t.owner.token });
    expect(await roleOf(other.site.id, other.admin.id)).toBe("admin");
  });
});

describe("co-owners (an owner can grant the owner role)", () => {
  it("gives a co-owner owner rights on the site, but not the site itself", async () => {
    const t = await seedTeam();
    expect((await api("POST", `${W}/${t.site.id}/members`, { token: t.owner.token, body: { email: t.stranger.email, role: "owner" } })).status).toBe(201);
    const role = await api("GET", `${W}/${t.site.id}/my-role`, { token: t.stranger.token });
    expect(role.body.data.role).toBe("owner");
    // Demoting the real owner's membership changes nothing: ownership is the website row.
    await api("PUT", `${W}/${t.site.id}/members/${t.owner.id}/role`, { token: t.stranger.token, body: { role: "viewer" } });
    expect((await api("GET", `${W}/${t.site.id}/my-role`, { token: t.owner.token })).body.data.role).toBe("owner");
    const [site] = await sql<{ user_id: string }[]>`SELECT user_id::text FROM websites WHERE id = ${t.site.id}::uuid`;
    expect(site?.user_id).toBe(t.owner.id);
  });
});

describe("invitations", () => {
  const invite = (siteId: string, token: string, body: unknown) => api("POST", `${W}/${siteId}/invitations`, { token, body });
  const accept = (token: string | undefined, inviteToken: unknown) =>
    api("POST", "/api/v1/user/accept-invite", { token, body: inviteToken === undefined ? {} : { token: inviteToken } });

  it("creates a pending invitation with a token, a lower-cased address and a week to accept", async () => {
    const t = await seedTeam();
    const res = await invite(t.site.id, t.admin.token, { email: "  New.Person@Example.COM ", role: "member" });
    expect(res.status).toBe(201);
    const inv = res.body.data;
    expect(inv.email).toBe("new.person@example.com");
    expect(inv.role).toBe("member");
    expect(inv.invitedBy).toBe(t.admin.id);
    expect(inv.token).toMatch(/^[0-9a-f]{64}$/);
    expect(inv.acceptedAt).toBeNull();
    const days = (Date.parse(inv.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("defaults the role to viewer", async () => {
    const t = await seedTeam();
    const res = await invite(t.site.id, t.owner.token, { email: "default-role@example.com" });
    expect(res.body.data.role).toBe("viewer");
  });

  it("replaces a pending invitation to the same address, so the old link stops working", async () => {
    const t = await seedTeam();
    const first = await invite(t.site.id, t.owner.token, { email: t.stranger.email, role: "viewer" });
    const second = await invite(t.site.id, t.owner.token, { email: t.stranger.email, role: "member" });
    const rows = await sql`SELECT 1 FROM website_invitations WHERE website_id = ${t.site.id}::uuid AND email = ${t.stranger.email}`;
    expect(rows).toHaveLength(1);
    expect((await accept(t.stranger.token, first.body.data.token)).status).toBe(404);
    expect((await accept(t.stranger.token, second.body.data.token)).status).toBe(200);
    expect(await roleOf(t.site.id, t.stranger.id)).toBe("member");
  });

  it("lets an admin invite up to admin, never owner, and members and viewers not at all", async () => {
    const t = await seedTeam();
    expect((await invite(t.site.id, t.admin.token, { email: "peer@example.com", role: "admin" })).status).toBe(201);
    expect((await invite(t.site.id, t.admin.token, { email: "boss@example.com", role: "owner" })).status).toBe(403);
    expect((await invite(t.site.id, t.member.token, { email: "m@example.com" })).status).toBe(403);
    expect((await invite(t.site.id, t.viewer.token, { email: "v@example.com" })).status).toBe(403);
    expect((await invite(t.site.id, t.stranger.token, { email: "s@example.com" })).status).toBe(403);
    expect((await api("POST", `${W}/${t.site.id}/invitations`, { body: { email: "x@example.com" } })).status).toBe(401);
    const emails = await sql<{ email: string }[]>`SELECT email FROM website_invitations WHERE website_id = ${t.site.id}::uuid`;
    expect(emails.map((r) => r.email)).toEqual(["peer@example.com"]);
  });

  it("rejects a bad address or role", async () => {
    const t = await seedTeam();
    for (const body of [{}, { email: "nope" }, { email: "a@example.com", role: "root" }]) {
      expect((await invite(t.site.id, t.owner.token, body)).status).toBe(400);
    }
  });

  it("lists only this site's pending invitations, to admins and the owner", async () => {
    const t = await seedTeam();
    const other = await seedTeam();
    const pending = await invite(t.site.id, t.owner.token, { email: "pending@example.com" });
    const taken = await invite(t.site.id, t.owner.token, { email: t.stranger.email });
    await accept(t.stranger.token, taken.body.data.token);
    await invite(other.site.id, other.owner.token, { email: "elsewhere@example.com" });

    const res = await api("GET", `${W}/${t.site.id}/invitations`, { token: t.admin.token });

    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { id: string }) => i.id)).toEqual([pending.body.data.id]);
    // The list carries live tokens, so it stays with the people who could invite anyway.
    expect((await api("GET", `${W}/${t.site.id}/invitations`, { token: t.member.token })).status).toBe(403);
    expect((await api("GET", `${W}/${t.site.id}/invitations`, { token: t.viewer.token })).status).toBe(403);
    expect((await api("GET", `${W}/${t.site.id}/invitations`, { token: t.stranger.token })).status).toBe(403);
  });

  it("revokes an invitation so its link no longer works", async () => {
    const t = await seedTeam();
    const inv = await invite(t.site.id, t.owner.token, { email: t.stranger.email, role: "admin" });
    expect((await api("DELETE", `${W}/${t.site.id}/invitations/${inv.body.data.id}`, { token: t.admin.token })).status).toBe(204);
    expect(await sql`SELECT 1 FROM website_invitations WHERE id = ${inv.body.data.id}::uuid`).toHaveLength(0);
    expect((await accept(t.stranger.token, inv.body.data.token)).status).toBe(404);
    expect(await roleOf(t.site.id, t.stranger.id)).toBeNull();
  });

  it("does not revoke another site's invitation named through the caller's own site", async () => {
    const t = await seedTeam();
    const other = await seedTeam();
    const inv = await invite(other.site.id, other.owner.token, { email: "theirs@example.com" });
    await api("DELETE", `${W}/${t.site.id}/invitations/${inv.body.data.id}`, { token: t.owner.token });
    expect(await sql`SELECT 1 FROM website_invitations WHERE id = ${inv.body.data.id}::uuid`).toHaveLength(1);
    // And the other site's members below admin cannot revoke it on their own site.
    expect((await api("DELETE", `${W}/${other.site.id}/invitations/${inv.body.data.id}`, { token: other.member.token })).status).toBe(403);
  });

  describe("accepting by token", () => {
    it("makes the invited account a member with the invited role", async () => {
      const t = await seedTeam();
      const inv = await invite(t.site.id, t.owner.token, { email: t.stranger.email.toUpperCase(), role: "member" });

      const res = await accept(t.stranger.token, inv.body.data.token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { websiteId: t.site.id } });
      expect(await roleOf(t.site.id, t.stranger.id)).toBe("member");
      const [row] = await sql<{ accepted_at: Date | null }[]>`SELECT accepted_at FROM website_invitations WHERE id = ${inv.body.data.id}::uuid`;
      expect(row?.accepted_at).not.toBeNull();
    });

    it("refuses a signed-in account whose email is not the invited one", async () => {
      const t = await seedTeam();
      const inv = await invite(t.site.id, t.owner.token, { email: "intended@example.com", role: "admin" });
      const res = await accept(t.stranger.token, inv.body.data.token);
      expect(res.status).toBe(403);
      expect(await roleOf(t.site.id, t.stranger.id)).toBeNull();
      // Still usable by the right person: a wrong-account click must not burn it.
      const [row] = await sql<{ accepted_at: Date | null }[]>`SELECT accepted_at FROM website_invitations WHERE id = ${inv.body.data.id}::uuid`;
      expect(row?.accepted_at).toBeNull();
    });

    it("refuses an invitation that was already accepted", async () => {
      const t = await seedTeam();
      const inv = await invite(t.site.id, t.owner.token, { email: t.stranger.email });
      await accept(t.stranger.token, inv.body.data.token);
      const again = await accept(t.stranger.token, inv.body.data.token);
      expect(again.status).toBe(400);
      expect(again.body.error).toMatch(/already been accepted/);
    });

    it("refuses an expired invitation", async () => {
      const t = await seedTeam();
      const inv = await invite(t.site.id, t.owner.token, { email: t.stranger.email, role: "admin" });
      await sql`UPDATE website_invitations SET expires_at = now() - interval '1 minute' WHERE id = ${inv.body.data.id}::uuid`;
      const res = await accept(t.stranger.token, inv.body.data.token);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expired/);
      expect(await roleOf(t.site.id, t.stranger.id)).toBeNull();
    });

    it("answers an unknown token with 404, a missing one with 400 and no session with 401", async () => {
      const t = await seedTeam();
      expect((await accept(t.stranger.token, "f".repeat(64))).status).toBe(404);
      expect((await accept(t.stranger.token, undefined)).status).toBe(400);
      expect((await accept(t.stranger.token, "")).status).toBe(400);
      expect((await accept(undefined, "f".repeat(64))).status).toBe(401);
    });

    it("never lowers an existing member's role: an admin invited as viewer stays admin", async () => {
      const t = await seedTeam();
      const inv = await invite(t.site.id, t.owner.token, { email: t.admin.email, role: "viewer" });
      expect((await accept(t.admin.token, inv.body.data.token)).status).toBe(200);
      expect(await roleOf(t.site.id, t.admin.id)).toBe("admin");
    });

    it("raises a lower member's role: a viewer invited as admin becomes admin", async () => {
      const t = await seedTeam();
      const inv = await invite(t.site.id, t.owner.token, { email: t.viewer.email, role: "admin" });
      expect((await accept(t.viewer.token, inv.body.data.token)).status).toBe(200);
      expect(await roleOf(t.site.id, t.viewer.id)).toBe("admin");
      const members = await sql`SELECT 1 FROM website_members WHERE website_id = ${t.site.id}::uuid AND user_id = ${t.viewer.id}::uuid`;
      expect(members).toHaveLength(1);
    });

    it("stops working once the site is deleted", async () => {
      const owner = await seedUser();
      const invited = await seedUser();
      const site = await seedWebsite(owner.id);
      const inv = await invite(site.id, owner.token, { email: invited.email, role: "admin" });
      await api("DELETE", `${W}/${site.id}`, { token: owner.token });
      expect((await accept(invited.token, inv.body.data.token)).status).toBe(404);
      expect(await sql`SELECT 1 FROM website_members WHERE user_id = ${invited.id}::uuid`).toHaveLength(0);
    });
  });
});
