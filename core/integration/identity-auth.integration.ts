import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { api, addMember, seedUser, seedWebsite, sql } from "./harness";

const freshEmail = () => `reg-${randomUUID().slice(0, 8)}@it.test`;

describe("registering", () => {
  it("creates the account and returns it signed in, on both mounts", async () => {
    for (const base of ["/api/v1/auth", "/api/v1/user/auth"]) {
      const email = freshEmail();
      const res = await api("POST", `${base}/register`, { body: { email: email.toUpperCase(), password: "longenough1", name: "Ann" } });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.name).toBe("Ann");
      expect(res.body.data.user).not.toHaveProperty("passwordHash");
      const me = await api("GET", "/api/v1/user/auth/me", { token: res.body.data.tokens.access_token });
      expect(me.status).toBe(200);
      expect(me.body.data.user.email).toBe(email);
    }
  });

  it("falls back to the address's local part for a missing name", async () => {
    const email = freshEmail();
    const res = await api("POST", "/api/v1/auth/register", { body: { email, password: "longenough1" } });
    expect(res.status).toBe(201);
    expect(res.body.data.user.name).toBe(email.split("@")[0]);
  });

  it("answers a taken address with the same generic failure, so it is no account oracle", async () => {
    const existing = await seedUser();
    const res = await api("POST", "/api/v1/auth/register", { body: { email: existing.email, password: "longenough1" } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Registration failed" });
    const rows = await sql`SELECT 1 FROM users WHERE email = ${existing.email}`;
    expect(rows).toHaveLength(1);
  });

  it("refuses a bad email, a short password, an oversize password and a non-JSON body", async () => {
    const bad = [
      { email: "not-an-email", password: "longenough1" },
      { email: freshEmail(), password: "short" },
      { email: freshEmail(), password: "x".repeat(257) },
      { password: "longenough1" },
    ];
    for (const body of bad) {
      const res = await api("POST", "/api/v1/auth/register", { body });
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    const garbled = await api("POST", "/api/v1/auth/register", { body: "{not json" });
    expect(garbled.status).toBe(400);
  });

  it("never makes a later account an admin", async () => {
    const res = await api("POST", "/api/v1/auth/register", { body: { email: freshEmail(), password: "longenough1" } });
    expect(res.body.data.user.role).toBe("user");
  });
});

describe("signing in", () => {
  it("returns tokens that work and counts the login", async () => {
    const user = await seedUser();
    const res = await api("POST", "/api/v1/auth/login", { body: { email: user.email.toUpperCase(), password: user.password } });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user.loginCount).toBe(1);
    const me = await api("GET", "/api/v1/user/auth/me", { token: res.body.data.tokens.access_token });
    expect(me.body.data.user.id).toBe(user.id);
  });

  it("gives an unknown address and a wrong password the same answer", async () => {
    const user = await seedUser();
    const wrong = await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: "not the password" } });
    const unknown = await api("POST", "/api/v1/auth/login", { body: { email: freshEmail(), password: "not the password" } });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it("refuses a disabled account with the same answer as a wrong password", async () => {
    const user = await seedUser({ isActive: false });
    const res = await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: user.password } });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "invalid credentials" });
  });

  it("refuses a missing password and an oversize one before checking anything", async () => {
    const user = await seedUser();
    expect((await api("POST", "/api/v1/auth/login", { body: { email: user.email } })).status).toBe(400);
    expect((await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: "x".repeat(257) } })).status).toBe(400);
  });
});

describe("refreshing a session", () => {
  it("exchanges a refresh token for a working pair", async () => {
    const user = await seedUser();
    const res = await api("POST", "/api/v1/auth/refresh", { body: { refresh_token: ` ${user.refreshToken} ` } });

    expect(res.status).toBe(200);
    const me = await api("GET", "/api/v1/user/auth/me", { token: res.body.access_token });
    expect(me.body.data.user.id).toBe(user.id);
    expect((await api("POST", "/api/v1/auth/refresh", { body: { refresh_token: res.body.refresh_token } })).status).toBe(200);
  });

  it("refuses an access token in place of a refresh token, and garbage", async () => {
    const user = await seedUser();
    for (const refresh_token of [user.token, "garbage", "a.b.c"]) {
      const res = await api("POST", "/api/v1/auth/refresh", { body: { refresh_token } });
      expect(res.status).toBe(401);
    }
    expect((await api("POST", "/api/v1/auth/refresh", { body: {} })).status).toBe(400);
  });

  it("refuses a refresh token used as a bearer token", async () => {
    const user = await seedUser();
    const res = await api("GET", "/api/v1/user/auth/me", { token: user.refreshToken });
    expect(res.status).toBe(401);
  });

  it("stops working once the account is disabled", async () => {
    const user = await seedUser();
    await sql`UPDATE users SET is_active = false WHERE id = ${user.id}::uuid`;
    const res = await api("POST", "/api/v1/auth/refresh", { body: { refresh_token: user.refreshToken } });
    expect(res.status).toBe(401);
  });
});

describe("changing the password", () => {
  it("ends older sessions at their next refresh and hands the caller a fresh pair that works", async () => {
    const user = await seedUser();
    const res = await api("PUT", "/api/v1/user/users/change-password", {
      token: user.token,
      body: { current_password: user.password, new_password: "a brand new secret" },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
    const stale = await api("POST", "/api/v1/auth/refresh", { body: { refresh_token: user.refreshToken } });
    expect(stale.status).toBe(401);
    const fresh = await api("POST", "/api/v1/auth/refresh", { body: { refresh_token: res.body.data.tokens.refresh_token } });
    expect(fresh.status).toBe(200);
    expect((await api("GET", "/api/v1/user/auth/me", { token: res.body.data.tokens.access_token })).status).toBe(200);

    // The new password signs in; the old one no longer does.
    expect((await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: "a brand new secret" } })).status).toBe(200);
    expect((await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: user.password } })).status).toBe(401);
  });

  it("refuses a wrong current password and leaves the hash alone", async () => {
    const user = await seedUser();
    const [before] = await sql<{ h: string }[]>`SELECT password_hash AS h FROM users WHERE id = ${user.id}::uuid`;
    const res = await api("PUT", "/api/v1/user/users/change-password", {
      token: user.token,
      body: { current_password: "nope nope nope", new_password: "a brand new secret" },
    });
    expect(res.status).toBe(400);
    const [after] = await sql<{ h: string }[]>`SELECT password_hash AS h FROM users WHERE id = ${user.id}::uuid`;
    expect(after!.h).toBe(before!.h);
  });

  it("refuses a too-short or too-long new password and missing fields", async () => {
    const user = await seedUser();
    for (const body of [
      { current_password: user.password, new_password: "short" },
      { current_password: user.password, new_password: "x".repeat(257) },
      { current_password: user.password },
      { new_password: "a brand new secret" },
    ]) {
      const res = await api("PUT", "/api/v1/user/users/change-password", { token: user.token, body });
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
  });

  it("needs a session, and a disabled account cannot change it", async () => {
    expect((await api("PUT", "/api/v1/user/users/change-password", { body: { current_password: "a", new_password: "bbbbbbbbbb" } })).status).toBe(401);
    const user = await seedUser({ isActive: false });
    const res = await api("PUT", "/api/v1/user/users/change-password", {
      token: user.token,
      body: { current_password: user.password, new_password: "a brand new secret" },
    });
    expect(res.status).toBe(401);
  });
});

describe("the signed-in user", () => {
  it("/me needs a valid bearer token or the access_token cookie", async () => {
    const user = await seedUser();
    expect((await api("GET", "/api/v1/user/auth/me")).status).toBe(401);
    expect((await api("GET", "/api/v1/user/auth/me", { token: "not.a.jwt" })).status).toBe(401);
    const cookie = await api("GET", "/api/v1/user/auth/me", { headers: { cookie: `access_token=${user.token}` } });
    expect(cookie.status).toBe(200);
    expect(cookie.body.data.user.id).toBe(user.id);
  });

  it("/me answers 404 for a token whose user was deleted", async () => {
    const user = await seedUser();
    await sql`DELETE FROM users WHERE id = ${user.id}::uuid`;
    expect((await api("GET", "/api/v1/user/auth/me", { token: user.token })).status).toBe(404);
  });

  it("profile, avatar and preferences need a session and return the caller's own data", async () => {
    const user = await seedUser();
    for (const [method, path] of [["PUT", "profile"], ["PUT", "avatar"], ["GET", "preferences"], ["PUT", "preferences"]] as const) {
      expect((await api(method, `/api/v1/user/users/${path}`, { body: {} })).status).toBe(401);
      expect((await api(method, `/api/v1/user/users/${path}`, { token: user.token, body: {} })).status).toBe(200);
    }
    const profile = await api("PUT", "/api/v1/user/users/profile", { token: user.token, body: { name: "x" } });
    expect(profile.body.data.user.email).toBe(user.email);
  });

  it("setup-status reports an install with users", async () => {
    await seedUser();
    const res = await api("GET", "/api/v1/user/auth/setup-status");
    expect(res.body).toEqual({ data: { setupComplete: true } });
  });

  it("password reset and OAuth are not offered", async () => {
    expect((await api("POST", "/api/v1/auth/forgot-password", { body: { email: "a@b.co" } })).status).toBeGreaterThanOrEqual(400);
    expect((await api("GET", "/api/v1/user/auth/google")).status).toBeGreaterThanOrEqual(400);
  });
});

describe("accepting an invitation", () => {
  async function invite(websiteId: string, invitedBy: string, email: string, role = "viewer", expiresIn = 86_400_000) {
    const token = `inv-${randomUUID()}`;
    await sql`INSERT INTO website_invitations (website_id, email, role, token, invited_by, expires_at)
              VALUES (${websiteId}::uuid, ${email}, ${role}, ${token}, ${invitedBy}::uuid, ${new Date(Date.now() + expiresIn)})`;
    return token;
  }

  it("adds the invited address as a member once, then refuses the same link", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const guest = await seedUser();
    const token = await invite(site.id, owner.id, guest.email.toUpperCase(), "member");

    const res = await api("POST", "/api/v1/user/accept-invite", { token: guest.token, body: { token } });
    expect(res.status).toBe(200);
    expect(res.body.data.websiteId).toBe(site.id);
    const [m] = await sql<{ role: string }[]>`SELECT role FROM website_members WHERE website_id = ${site.id}::uuid AND user_id = ${guest.id}::uuid`;
    expect(m!.role).toBe("member");

    expect((await api("POST", "/api/v1/user/accept-invite", { token: guest.token, body: { token } })).status).toBe(400);
  });

  it("refuses someone signed in as a different address", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const token = await invite(site.id, owner.id, "someone-else@it.test");
    const other = await seedUser();

    const res = await api("POST", "/api/v1/user/accept-invite", { token: other.token, body: { token } });
    expect(res.status).toBe(403);
    expect(await sql`SELECT 1 FROM website_members WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
  });

  it("never lowers an existing member's role", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const admin = await seedUser();
    await addMember(site.id, admin.id, "admin");
    const token = await invite(site.id, owner.id, admin.email, "viewer");

    expect((await api("POST", "/api/v1/user/accept-invite", { token: admin.token, body: { token } })).status).toBe(200);
    const [m] = await sql<{ role: string }[]>`SELECT role FROM website_members WHERE website_id = ${site.id}::uuid AND user_id = ${admin.id}::uuid`;
    expect(m!.role).toBe("admin");
  });

  it("refuses an expired, unknown or missing token, and an anonymous caller", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const guest = await seedUser();
    const expired = await invite(site.id, owner.id, guest.email, "viewer", -1000);

    expect((await api("POST", "/api/v1/user/accept-invite", { token: guest.token, body: { token: expired } })).status).toBe(400);
    expect((await api("POST", "/api/v1/user/accept-invite", { token: guest.token, body: { token: "nope" } })).status).toBe(404);
    expect((await api("POST", "/api/v1/user/accept-invite", { token: guest.token, body: {} })).status).toBe(400);
    expect((await api("POST", "/api/v1/user/accept-invite", { body: { token: expired } })).status).toBe(401);
  });
});
