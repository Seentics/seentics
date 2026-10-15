import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { fileUnderClient, keyHeader, mintAccountKey, seedClient } from "./helpers/identity";

const M = "/api/v1/manage";

async function owner(scopes?: string[]) {
  const user = await seedUser();
  const { key } = await mintAccountKey(user, scopes);
  return { user, headers: keyHeader(key) };
}

describe("management API authentication", () => {
  it("needs an account key, and a session token is not one", async () => {
    const user = await seedUser();
    const none = await api("GET", `${M}/clients`);
    expect(none.status).toBe(401);
    expect(none.body.code).toBe("missing_api_key");
    expect((await api("GET", `${M}/clients`, { token: user.token })).status).toBe(401);
    expect((await api("GET", `${M}/clients`, { headers: keyHeader("   ") })).status).toBe(401);
  });

  it("lets a read-only key read and refuses it every write", async () => {
    const { user, headers } = await owner(["websites:read"]);
    const site = await seedWebsite(user.id);

    expect((await api("GET", `${M}/websites/${site.id}`, { headers })).status).toBe(200);
    const write = await api("POST", `${M}/clients`, { headers, body: { name: "Acme" } });
    expect(write.status).toBe(403);
    expect(write.body.required_scope).toBe("websites:write");
    expect((await api("DELETE", `${M}/websites/${site.id}`, { headers })).status).toBe(403);
    expect(await sql`SELECT 1 FROM websites WHERE id = ${site.id}::uuid`).toHaveLength(1);
    expect(await sql`SELECT 1 FROM clients WHERE user_id = ${user.id}::uuid`).toHaveLength(0);
  });

  it("refuses reads to a write-only key and both to a data-only key", async () => {
    const w = await owner(["websites:write"]);
    expect((await api("GET", `${M}/clients`, { headers: w.headers })).body.required_scope).toBe("websites:read");
    expect((await api("POST", `${M}/clients`, { headers: w.headers, body: { name: "ok" } })).status).toBe(201);

    const d = await owner(["analytics:read"]);
    expect((await api("GET", `${M}/clients`, { headers: d.headers })).status).toBe(403);
    expect((await api("POST", `${M}/clients`, { headers: d.headers, body: { name: "no" } })).status).toBe(403);
  });
});

describe("provisioning clients", () => {
  it("creates a client with its site and returns the snippet that installs it", async () => {
    const { user, headers } = await owner();
    const res = await api("POST", `${M}/clients`, {
      headers,
      body: {
        external_id: "tenant-1",
        name: "Acme",
        website: { name: "Acme site", url: "https://acme.example" },
        features_enabled: { replays: false },
        limits: { max_websites: 2 },
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    const client = res.body.data;
    expect(client.external_id).toBe("tenant-1");
    expect(client.websites).toHaveLength(1);
    expect(client.websites[0].snippet).toContain(`data-website-id="${client.websites[0].id}"`);
    const [site] = await sql<{ user_id: string; client_id: string }[]>`
      SELECT user_id::text, client_id::text FROM websites WHERE id = ${client.websites[0].id}::uuid`;
    expect(site).toEqual({ user_id: user.id, client_id: client.id });
  });

  it("is idempotent on external_id: a retry returns the same client and makes no second site", async () => {
    const { user, headers } = await owner();
    const body = { external_id: "tenant-retry", name: "Acme", website: { name: "s", url: "https://retry.example" } };
    const first = await api("POST", `${M}/clients`, { headers, body });
    const again = await api("POST", `${M}/clients`, { headers, body: { ...body, name: "Renamed" } });

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(again.body.data.name).toBe("Acme");
    expect(await sql`SELECT 1 FROM clients WHERE user_id = ${user.id}::uuid`).toHaveLength(1);
    expect(await sql`SELECT 1 FROM websites WHERE user_id = ${user.id}::uuid`).toHaveLength(1);
  });

  it("does not share an external_id between two accounts", async () => {
    const a = await owner();
    const b = await owner();
    const ra = await api("POST", `${M}/clients`, { headers: a.headers, body: { external_id: "same", name: "A" } });
    const rb = await api("POST", `${M}/clients`, { headers: b.headers, body: { external_id: "same", name: "B" } });
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    expect(rb.body.data.id).not.toBe(ra.body.data.id);
  });

  it("looks a client up by external_id, and finds nothing for another account's", async () => {
    const a = await owner();
    const b = await owner();
    await api("POST", `${M}/clients`, { headers: a.headers, body: { external_id: "lookup-me", name: "A" } });

    const mine = await api("GET", `${M}/clients`, { headers: a.headers, query: { external_id: "lookup-me" } });
    expect(mine.body.data).toHaveLength(1);
    const theirs = await api("GET", `${M}/clients`, { headers: b.headers, query: { external_id: "lookup-me" } });
    expect(theirs.body.data).toEqual([]);
  });

  it("refuses a missing name, unknown features, a negative limit and oversize metadata", async () => {
    const { user, headers } = await owner();
    for (const body of [
      {},
      { name: "" },
      { name: "x", features_enabled: { teleport: true } },
      { name: "x", limits: { max_websites: -1 } },
      { name: "x", metadata: { blob: "y".repeat(5000) } },
      { name: "x", website: { name: "no url" } },
    ]) {
      const res = await api("POST", `${M}/clients`, { headers, body });
      expect({ body: Object.keys(body), status: res.status }).toEqual({ body: Object.keys(body), status: 400 });
    }
    expect(await sql`SELECT 1 FROM clients WHERE user_id = ${user.id}::uuid`).toHaveLength(0);
  });

  it("updates a client's switches by merging and refuses an external_id another client has", async () => {
    const { headers } = await owner();
    const one = await api("POST", `${M}/clients`, { headers, body: { external_id: "one", name: "One" } });
    const two = await api("POST", `${M}/clients`, { headers, body: { external_id: "two", name: "Two", features_enabled: { replays: false } } });

    const patched = await api("PATCH", `${M}/clients/${two.body.data.id}`, { headers, body: { status: "suspended", features_enabled: { heatmaps: false } } });
    expect(patched.status).toBe(200);
    expect(patched.body.data.status).toBe("suspended");
    expect(patched.body.data.name).toBe("Two");
    expect(patched.body.data.features_enabled).toMatchObject({ replays: false, heatmaps: false });
    expect((await api("PATCH", `${M}/clients/${two.body.data.id}`, { headers, body: { status: "paused" } })).status).toBe(400);

    const clash = await api("PATCH", `${M}/clients/${two.body.data.id}`, { headers, body: { external_id: "one" } });
    expect(clash.status).toBe(409);
    expect(one.status).toBe(201);
  });

  it("enforces the client's website limit", async () => {
    const { headers } = await owner();
    const c = await api("POST", `${M}/clients`, {
      headers,
      body: { name: "Small", limits: { max_websites: 1 }, website: { name: "first", url: "https://first.example" } },
    });
    const res = await api("POST", `${M}/websites`, { headers, body: { name: "second", url: "second.example", client_id: c.body.data.id } });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("website_limit_reached");
  });

  it("deletes a client and keeps its sites ungrouped unless asked to delete them", async () => {
    const { user, headers } = await owner();
    const keep = await api("POST", `${M}/clients`, { headers, body: { name: "Keep", website: { name: "k", url: "https://keep.example" } } });
    const drop = await api("POST", `${M}/clients`, { headers, body: { name: "Drop", website: { name: "d", url: "https://drop.example" } } });
    const keptSite = keep.body.data.websites[0].id;
    const droppedSite = drop.body.data.websites[0].id;

    expect((await api("DELETE", `${M}/clients/${keep.body.data.id}`, { headers })).status).toBe(204);
    expect((await api("DELETE", `${M}/clients/${drop.body.data.id}`, { headers, query: { delete_websites: true } })).status).toBe(204);

    const [kept] = await sql<{ client_id: string | null }[]>`SELECT client_id::text FROM websites WHERE id = ${keptSite}::uuid`;
    expect(kept!.client_id).toBeNull();
    expect(await sql`SELECT 1 FROM websites WHERE id = ${droppedSite}::uuid`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM clients WHERE user_id = ${user.id}::uuid`).toHaveLength(0);
  });
});

describe("another account's clients and websites", () => {
  it("read as not found for every method", async () => {
    const victim = await seedUser();
    const site = await seedWebsite(victim.id);
    const clientId = await seedClient(victim.id);
    const { headers } = await owner();

    for (const [method, path] of [
      ["GET", `${M}/clients/${clientId}`],
      ["PATCH", `${M}/clients/${clientId}`],
      ["DELETE", `${M}/clients/${clientId}`],
      ["GET", `${M}/clients/${clientId}/websites`],
      ["GET", `${M}/websites/${site.id}`],
      ["PATCH", `${M}/websites/${site.id}`],
      ["DELETE", `${M}/websites/${site.id}`],
    ] as const) {
      const res = await api(method, path, { headers, body: method === "PATCH" ? { name: "pwned" } : undefined });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 404 });
    }
    expect(await sql`SELECT 1 FROM websites WHERE id = ${site.id}::uuid AND name = 'Test site'`).toHaveLength(1);
    expect(await sql`SELECT 1 FROM clients WHERE id = ${clientId}::uuid`).toHaveLength(1);
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
    expect((await api("GET", `${M}/clients/not-a-uuid`, { headers })).status).toBe(404);
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

describe("embed links through the management API", () => {
  it("makes a website's link once, changes its sections, and revokes it", async () => {
    const { user, headers } = await owner();
    const site = await seedWebsite(user.id);

    const made = await api("POST", `${M}/websites/${site.id}/embed-link`, { headers });
    expect(made.status).toBe(201);
    expect(made.body.data.sections).toEqual(["analytics"]);
    const again = await api("POST", `${M}/websites/${site.id}/embed-link`, { headers });
    expect(again.status).toBe(200);
    expect(again.body.data.token).toBe(made.body.data.token);

    const patched = await api("PATCH", `${M}/websites/${site.id}/embed-link`, { headers, body: { sections: ["heatmaps", "analytics"] } });
    expect(patched.body.data.sections).toEqual(["analytics", "heatmaps"]);
    expect((await api("PATCH", `${M}/websites/${site.id}/embed-link`, { headers, body: { sections: [] } })).status).toBe(400);
    expect((await api("PATCH", `${M}/websites/${site.id}/embed-link`, { headers, body: { sections: ["passwords"] } })).status).toBe(400);
    expect((await api("POST", `${M}/websites/${site.id}/embed-link`, { headers, body: "{bad" })).status).toBe(400);

    expect((await api("DELETE", `${M}/websites/${site.id}/embed-link`, { headers })).status).toBe(204);
    expect((await api("DELETE", `${M}/websites/${site.id}/embed-link`, { headers })).status).toBe(404);
    const info = await api("GET", `/api/v1/embed/${site.id}/info`, { headers: { "X-Embed-Token": made.body.data.token } });
    expect(info.status).toBe(401);
  });

  it("needs websites:write and the caller's own target", async () => {
    const victim = await seedUser();
    const theirs = await seedWebsite(victim.id);
    const theirClient = await seedClient(victim.id);
    const { headers } = await owner();
    const reader = await owner(["websites:read"]);
    const mine = await seedWebsite(reader.user.id);

    expect((await api("POST", `${M}/websites/${theirs.id}/embed-link`, { headers })).status).toBe(404);
    expect((await api("POST", `${M}/clients/${theirClient}/embed-link`, { headers })).status).toBe(404);
    expect((await api("POST", `${M}/websites/not-a-uuid/embed-link`, { headers })).status).toBe(404);
    expect((await api("POST", `${M}/websites/${mine.id}/embed-link`, { headers: reader.headers })).status).toBe(403);
    expect(await sql`SELECT 1 FROM embed_links WHERE website_id = ${theirs.id}::uuid OR client_id = ${theirClient}::uuid`).toHaveLength(0);
  });

  it("makes a client's link that reads the client's sites", async () => {
    const { user, headers } = await owner();
    const clientId = await seedClient(user.id, { name: "Agency client" });
    const site = await seedWebsite(user.id);
    await fileUnderClient(site.id, clientId);

    const made = await api("POST", `${M}/clients/${clientId}/embed-link`, { headers, body: { sections: ["analytics"] } });
    expect(made.status).toBe(201);
    expect(made.body.data.embed_url).toContain("client=1");
    const list = await api("GET", `/api/v1/embed/client/${clientId}/websites`, { query: { token: made.body.data.token } });
    expect(list.status).toBe(200);
    expect(list.body.data.websites.map((w: { id: string }) => w.id)).toEqual([site.id]);
  });
});

it("an unknown management path answers 404 with a valid key", async () => {
  const { headers } = await owner();
  expect((await api("GET", `${M}/nothing-here/${randomUUID()}`, { headers })).status).toBe(404);
});
