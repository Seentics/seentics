import { describe, expect, it } from "bun:test";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { keyHeader, mintAccountKey, seedClient } from "./helpers/identity";

const M = "/api/v1/manage";

async function owner(scopes?: string[]) {
  const user = await seedUser();
  const { key } = await mintAccountKey(user, scopes);
  return { user, headers: keyHeader(key) };
}

describe("management API authentication", () => {
  it("needs an account key, and a session token is not one", async () => {
    const user = await seedUser();
    const none = await api("GET", `${M}/websites`);
    expect(none.status).toBe(401);
    expect(none.body.code).toBe("missing_api_key");
    expect((await api("GET", `${M}/websites`, { token: user.token })).status).toBe(401);
    expect((await api("GET", `${M}/websites`, { headers: keyHeader("   ") })).status).toBe(401);
  });

  it("lets a read-only key read and refuses it every write", async () => {
    const { user, headers } = await owner(["websites:read"]);
    const site = await seedWebsite(user.id);

    expect((await api("GET", `${M}/websites/${site.id}`, { headers })).status).toBe(200);
    const write = await api("POST", `${M}/websites`, { headers, body: { name: "Acme", url: "acme.example" } });
    expect(write.status).toBe(403);
    expect(write.body.required_scope).toBe("websites:write");
    expect((await api("DELETE", `${M}/websites/${site.id}`, { headers })).status).toBe(403);
    expect(await sql`SELECT 1 FROM websites WHERE id = ${site.id}::uuid`).toHaveLength(1);
  });

  it("refuses reads to a write-only key and both to a data-only key", async () => {
    const w = await owner(["websites:write"]);
    expect((await api("GET", `${M}/websites`, { headers: w.headers })).body.required_scope).toBe("websites:read");
    expect((await api("POST", `${M}/websites`, { headers: w.headers, body: { name: "ok", url: "ok.example" } })).status).toBe(201);

    const d = await owner(["analytics:read"]);
    expect((await api("GET", `${M}/websites`, { headers: d.headers })).status).toBe(403);
    expect((await api("POST", `${M}/websites`, { headers: d.headers, body: { name: "no", url: "no.example" } })).status).toBe(403);
  });

  // Clients and embed links are the agency workspace's now (agency-workspace.integration.ts).
  it("no longer serves clients or embed links", async () => {
    const { user, headers } = await owner();
    const site = await seedWebsite(user.id);
    expect((await api("GET", `${M}/clients`, { headers })).status).toBe(404);
    expect((await api("POST", `${M}/clients`, { headers, body: { name: "x" } })).status).toBe(404);
    expect((await api("POST", `${M}/websites/${site.id}/embed-link`, { headers })).status).toBe(404);
  });
});

describe("another account's websites", () => {
  it("read as not found for every method", async () => {
    const victim = await seedUser();
    const site = await seedWebsite(victim.id);
    const { headers } = await owner();

    for (const [method, path] of [
      ["GET", `${M}/websites/${site.id}`],
      ["PATCH", `${M}/websites/${site.id}`],
      ["DELETE", `${M}/websites/${site.id}`],
    ] as const) {
      const res = await api(method, path, { headers, body: method === "PATCH" ? { name: "pwned" } : undefined });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 404 });
    }
    expect(await sql`SELECT 1 FROM websites WHERE id = ${site.id}::uuid AND name = 'Test site'`).toHaveLength(1);
  });

  it("cannot file a new site under another account's client", async () => {
    const victim = await seedUser();
    const clientId = await seedClient(victim.id);
    const { user, headers } = await owner();
    const res = await api("POST", `${M}/websites`, { headers, body: { name: "x", url: "x.example", client_id: clientId } });
    expect(res.status).toBe(404);
    expect(await sql`SELECT 1 FROM websites WHERE user_id = ${user.id}::uuid`).toHaveLength(0);
  });

  it("are not reachable by a key whose owner is only an admin member of the site", async () => {
    // The management API is owner-only: membership grants dashboard access, not provisioning.
    const realOwner = await seedUser();
    const site = await seedWebsite(realOwner.id);
    const { user, headers } = await owner();
    await addMember(site.id, user.id, "admin");

    expect((await api("GET", `${M}/websites/${site.id}`, { headers })).status).toBe(404);
    const list = await api("GET", `${M}/websites`, { headers });
    expect(list.body.data.map((w: { id: string }) => w.id)).not.toContain(site.id);
  });

  it("answers a malformed id as not found rather than an error", async () => {
    const { headers } = await owner();
    expect((await api("GET", `${M}/websites/not-a-uuid`, { headers })).status).toBe(404);
  });
});

describe("provisioning websites", () => {
  it("creates a site from a bare host, lists it by client, moves it and deletes it", async () => {
    const { user, headers } = await owner();
    const clientId = await seedClient(user.id);
    const created = await api("POST", `${M}/websites`, { headers, body: { name: "Bare", url: "bare-host.example" } });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data.snippet).toContain(id);

    const moved = await api("PATCH", `${M}/websites/${id}`, { headers, body: { client_id: clientId } });
    expect(moved.status).toBe(200);
    const byClient = await api("GET", `${M}/websites`, { headers, query: { client_id: clientId } });
    expect(byClient.body.data.map((w: { id: string }) => w.id)).toEqual([id]);

    expect((await api("PATCH", `${M}/websites/${id}`, { headers, body: { client_id: "nope" } })).status).toBe(400);
    expect((await api("PATCH", `${M}/websites/${id}`, { headers, body: { client_id: null } })).status).toBe(200);
    expect((await api("DELETE", `${M}/websites/${id}`, { headers })).status).toBe(204);
    expect(await sql`SELECT 1 FROM websites WHERE id = ${id}::uuid`).toHaveLength(0);
  });

  it("refuses a site with no name or url, and bad paging", async () => {
    const { headers } = await owner();
    expect((await api("POST", `${M}/websites`, { headers, body: { url: "x.example" } })).status).toBe(400);
    expect((await api("POST", `${M}/websites`, { headers, body: { name: "x" } })).status).toBe(400);
    expect((await api("GET", `${M}/websites`, { headers, query: { limit: 0 } })).status).toBe(400);
    expect((await api("GET", `${M}/websites`, { headers, query: { limit: 101 } })).status).toBe(400);
  });

  it("pages with has_more", async () => {
    const { user, headers } = await owner();
    for (let i = 0; i < 3; i++) await seedWebsite(user.id);
    const first = await api("GET", `${M}/websites`, { headers, query: { limit: 2 } });
    expect(first.body.data).toHaveLength(2);
    expect(first.body.has_more).toBe(true);
    const rest = await api("GET", `${M}/websites`, { headers, query: { limit: 2, offset: 2 } });
    expect(rest.body.data).toHaveLength(1);
    expect(rest.body.has_more).toBe(false);
  });
});
