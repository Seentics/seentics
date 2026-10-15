import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { MISSING_ID } from "./helpers/websites";

const C = "/api/v1/user/agency/clients";
const S = "/api/v1/user/agency/websites";

async function clientRows(ownerId: string) {
  return sql<{ id: string; name: string }[]>`SELECT id::text, name FROM clients WHERE user_id = ${ownerId}::uuid ORDER BY created_at`;
}

describe("agency clients", () => {
  it("needs a session on every route", async () => {
    for (const [method, path] of [["GET", C], ["POST", C], ["GET", `${C}/${MISSING_ID}`], ["PATCH", `${C}/${MISSING_ID}`],
      ["DELETE", `${C}/${MISSING_ID}`], ["GET", `${C}/${MISSING_ID}/websites`], ["GET", `${C}/${MISSING_ID}/analytics`],
      ["GET", S], ["POST", S], ["GET", `${S}/${MISSING_ID}`], ["PATCH", `${S}/${MISSING_ID}`], ["DELETE", `${S}/${MISSING_ID}`]] as const) {
      const res = await api(method, path, { body: method === "POST" || method === "PATCH" ? { name: "x" } : undefined });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  });

  it("creates a client with every feature on and nothing capped", async () => {
    const owner = await seedUser();
    const res = await api("POST", C, { token: owner.token, body: { name: "  Acme  ", company: "Acme Ltd", email: "ops@acme.test" } });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    const c = res.body.data;
    expect(c.name).toBe("Acme");
    expect(c.status).toBe("active");
    expect(Object.values(c.features_enabled).every((v) => v === true)).toBe(true);
    expect(c.limits).toEqual({ max_websites: null, max_monthly_events: null, max_replays: null, max_heatmaps: null });
    expect(c.websites).toEqual([]);
    expect((await clientRows(owner.id)).map((r) => r.id)).toEqual([c.id]);
  });

  it("creates the client's first website with it, grouped under the client, with an install snippet", async () => {
    const owner = await seedUser();
    const res = await api("POST", C, { token: owner.token, body: { name: "Acme", website: { name: "Acme site", url: "www.Acme-Shop.test" } } });
    expect(res.status).toBe(201);
    const [site] = res.body.data.websites;
    expect(site.url).toBe("acme-shop.test");
    expect(site.client_id).toBe(res.body.data.id);
    expect(site.snippet).toContain(`data-website-id="${site.id}"`);
    const [row] = await sql<{ user_id: string; client_id: string }[]>`SELECT user_id::text, client_id::text FROM websites WHERE id = ${site.id}::uuid`;
    expect(row).toEqual({ user_id: owner.id, client_id: res.body.data.id });
  });

  it("returns the existing client for a repeated external_id instead of making a second", async () => {
    const owner = await seedUser();
    const first = await api("POST", C, { token: owner.token, body: { name: "Acme", external_id: "tenant-1" } });
    const again = await api("POST", C, { token: owner.token, body: { name: "Acme again", external_id: "tenant-1" } });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(await clientRows(owner.id)).toHaveLength(1);

    const found = await api("GET", C, { token: owner.token, query: { external_id: "tenant-1" } });
    expect(found.body.data.map((c: { id: string }) => c.id)).toEqual([first.body.data.id]);
    expect((await api("GET", C, { token: owner.token, query: { external_id: "nope" } })).body.data).toEqual([]);
  });

  it("keeps external ids per owner: another account may use the same one", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const ca = await api("POST", C, { token: a.token, body: { name: "A", external_id: "shared-ext" } });
    const cb = await api("POST", C, { token: b.token, body: { name: "B", external_id: "shared-ext" } });
    expect(cb.status).toBe(201);
    expect(cb.body.data.id).not.toBe(ca.body.data.id);
    // And a lookup never finds the other owner's client.
    const found = await api("GET", C, { token: b.token, query: { external_id: "shared-ext" } });
    expect(found.body.data.map((c: { id: string }) => c.id)).toEqual([cb.body.data.id]);
  });

  it("rejects a missing name, unknown feature or limit keys, a negative limit and oversize metadata", async () => {
    const owner = await seedUser();
    for (const body of [
      {},
      { name: "" },
      { name: "n".repeat(121) },
      { name: "x", features_enabled: { teleport: false } },
      { name: "x", limits: { max_widgets: 1 } },
      { name: "x", limits: { max_websites: -1 } },
      { name: "x", status: "deleted" },
      { name: "x", metadata: { blob: "b".repeat(5000) } },
      { name: "x", website: { name: "no url" } },
    ]) {
      const res = await api("POST", C, { token: owner.token, body });
      expect({ body: JSON.stringify(body).slice(0, 60), status: res.status }).toEqual({ body: JSON.stringify(body).slice(0, 60), status: 400 });
    }
    expect(await clientRows(owner.id)).toHaveLength(0);
  });

  it("lists only the caller's clients, a page at a time", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    for (const name of ["one", "two", "three"]) await api("POST", C, { token: owner.token, body: { name } });
    await api("POST", C, { token: other.token, body: { name: "theirs" } });

    const page1 = await api("GET", C, { token: owner.token, query: { limit: 2 } });
    const page2 = await api("GET", C, { token: owner.token, query: { limit: 2, offset: 2 } });

    expect(page1.body.data.map((c: { name: string }) => c.name)).toEqual(["one", "two"]);
    expect(page1.body.has_more).toBe(true);
    expect(page2.body.data.map((c: { name: string }) => c.name)).toEqual(["three"]);
    expect(page2.body.has_more).toBe(false);
    expect((await api("GET", C, { token: owner.token, query: { limit: 0 } })).status).toBe(400);
    expect((await api("GET", C, { token: owner.token, query: { limit: 101 } })).status).toBe(400);
  });

  it("answers another owner's client exactly like a missing one", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const theirs = (await api("POST", C, { token: other.token, body: { name: "Theirs", website: { name: "s", url: "theirs.test" } } })).body.data;

    for (const [method, path, body] of [
      ["GET", `${C}/${theirs.id}`, undefined],
      ["GET", `${C}/${theirs.id}/websites`, undefined],
      ["GET", `${C}/${theirs.id}/analytics`, undefined],
      ["PATCH", `${C}/${theirs.id}`, { name: "Hijacked" }],
      ["DELETE", `${C}/${theirs.id}`, undefined],
      ["GET", `${C}/${MISSING_ID}`, undefined],
    ] as const) {
      const res = await api(method, path, { token: owner.token, body });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 404 });
    }
    const [row] = await sql<{ name: string }[]>`SELECT name FROM clients WHERE id = ${theirs.id}::uuid`;
    expect(row?.name).toBe("Theirs");
  });

  it("answers a malformed client id with 404, not 500", async () => {
    const owner = await seedUser();
    expect((await api("GET", `${C}/not-a-uuid`, { token: owner.token })).status).toBe(404);
  });

  it("merges feature switches and limits on update, so one key changes one thing", async () => {
    const owner = await seedUser();
    const c = (await api("POST", C, { token: owner.token, body: { name: "Acme", features_enabled: { replays: false }, limits: { max_replays: 10 } } })).body.data;

    const res = await api("PATCH", `${C}/${c.id}`, { token: owner.token, body: { features_enabled: { heatmaps: false }, limits: { max_websites: 2 }, status: "suspended" } });

    expect(res.status).toBe(200);
    expect(res.body.data.features_enabled).toEqual(expect.objectContaining({ replays: false, heatmaps: false, analytics: true }));
    expect(res.body.data.limits).toEqual(expect.objectContaining({ max_replays: 10, max_websites: 2 }));
    expect(res.body.data.status).toBe("suspended");
    expect(res.body.data.name).toBe("Acme");
  });

  it("refuses to give a client an external id another of the caller's clients holds", async () => {
    const owner = await seedUser();
    await api("POST", C, { token: owner.token, body: { name: "A", external_id: "taken" } });
    const b = (await api("POST", C, { token: owner.token, body: { name: "B" } })).body.data;
    const res = await api("PATCH", `${C}/${b.id}`, { token: owner.token, body: { external_id: "taken" } });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("external_id_taken");
  });

  it("lists a client's websites and the ids its analytics view opens", async () => {
    const owner = await seedUser();
    const c = (await api("POST", C, { token: owner.token, body: { name: "Acme", website: { name: "s1", url: "s1.acme.test" } } })).body.data;
    const second = await api("POST", S, { token: owner.token, body: { name: "s2", url: "s2.acme.test", client_id: c.id } });
    await seedWebsite(owner.id); // ungrouped, must not appear

    const sites = await api("GET", `${C}/${c.id}/websites`, { token: owner.token });
    const analytics = await api("GET", `${C}/${c.id}/analytics`, { token: owner.token });

    expect(sites.body.data.map((s: { url: string }) => s.url)).toEqual(["s1.acme.test", "s2.acme.test"]);
    expect(analytics.body.data.websiteIds).toEqual([c.websites[0].id, second.body.data.id]);
  });

  it("stops new sites once a client reaches its website cap", async () => {
    const owner = await seedUser();
    const c = (await api("POST", C, { token: owner.token, body: { name: "Capped", limits: { max_websites: 1 }, website: { name: "s1", url: "cap1.test" } } })).body.data;
    const res = await api("POST", S, { token: owner.token, body: { name: "s2", url: "cap2.test", client_id: c.id } });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("website_limit_reached");
    // Moving an existing site in is held to the same cap.
    const loose = await seedWebsite(owner.id);
    expect((await api("PATCH", `${S}/${loose.id}`, { token: owner.token, body: { client_id: c.id } })).status).toBe(409);
    const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM websites WHERE client_id = ${c.id}::uuid`;
    expect(n?.n).toBe(1);
  });

  it("keeps the client's sites, ungrouped, when the client is deleted", async () => {
    const owner = await seedUser();
    const c = (await api("POST", C, { token: owner.token, body: { name: "Acme", website: { name: "s", url: "kept.acme.test" } } })).body.data;
    const res = await api("DELETE", `${C}/${c.id}`, { token: owner.token });
    expect(res.status).toBe(204);
    expect(await sql`SELECT 1 FROM clients WHERE id = ${c.id}::uuid`).toHaveLength(0);
    const [site] = await sql<{ client_id: string | null }[]>`SELECT client_id::text FROM websites WHERE id = ${c.websites[0].id}::uuid`;
    expect(site).toEqual({ client_id: null });
  });

  it("deletes the client's sites and their data with delete_websites=true", async () => {
    const owner = await seedUser();
    const c = (await api("POST", C, { token: owner.token, body: { name: "Acme", website: { name: "s", url: "gone.acme.test" } } })).body.data;
    const siteId = c.websites[0].id;
    await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
              VALUES (${siteId}, 'pageview', '/', 'v', 's', now())`;
    await sql`INSERT INTO goals (website_id, name, type, identifier) VALUES (${siteId}::uuid, 'g', 'pageview', '/x')`;

    const res = await api("DELETE", `${C}/${c.id}`, { token: owner.token, query: { delete_websites: "true" } });

    expect(res.status).toBe(204);
    expect(await sql`SELECT 1 FROM websites WHERE id = ${siteId}::uuid`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM analytics_events WHERE website_id = ${siteId}`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM goals WHERE website_id = ${siteId}::uuid`).toHaveLength(0);
  });

  it("a client created with a website it cannot make is not left behind", async () => {
    const owner = await seedUser();
    // The website cap is checked after the client is inserted; the 409 leaves a client with no site.
    const res = await api("POST", C, { token: owner.token, body: { name: "Half", limits: { max_websites: 0 }, website: { name: "s", url: "half.test" } } });
    expect(res.status).toBe(409);
    expect(await clientRows(owner.id)).toHaveLength(0);
  });
});

describe("agency websites (owner-only)", () => {
  it("creates a site from a bare host and lists it with its snippet", async () => {
    const owner = await seedUser();
    const res = await api("POST", S, { token: owner.token, body: { name: "Bare", url: "WWW.Bare-Host.test" } });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe("bare-host.test");
    expect(res.body.data.snippet).toContain(res.body.data.id);
    expect(res.body.data.client_id).toBeNull();
    const list = await api("GET", S, { token: owner.token });
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([res.body.data.id]);
  });

  it("filters the list by client and rejects a malformed client id", async () => {
    const owner = await seedUser();
    const c = (await api("POST", C, { token: owner.token, body: { name: "Acme", website: { name: "s", url: "in.acme.test" } } })).body.data;
    await seedWebsite(owner.id);
    const res = await api("GET", S, { token: owner.token, query: { client_id: c.id } });
    expect(res.body.data.map((s: { id: string }) => s.id)).toEqual([c.websites[0].id]);
    expect((await api("GET", S, { token: owner.token, query: { client_id: "nope" } })).status).toBe(400);
  });

  it("will not put a site under another owner's client", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const theirs = (await api("POST", C, { token: other.token, body: { name: "Theirs" } })).body.data;
    const res = await api("POST", S, { token: owner.token, body: { name: "s", url: "sneak.test", client_id: theirs.id } });
    expect(res.status).toBe(404);
    expect(await sql`SELECT 1 FROM websites WHERE user_id = ${owner.id}::uuid`).toHaveLength(0);

    const mine = await seedWebsite(owner.id);
    expect((await api("PATCH", `${S}/${mine.id}`, { token: owner.token, body: { client_id: theirs.id } })).status).toBe(404);
    const [row] = await sql<{ client_id: string | null }[]>`SELECT client_id::text FROM websites WHERE id = ${mine.id}::uuid`;
    expect(row?.client_id).toBeNull();
  });

  it("moves a site between clients and ungroups it with null", async () => {
    const owner = await seedUser();
    const a = (await api("POST", C, { token: owner.token, body: { name: "A" } })).body.data;
    const site = await seedWebsite(owner.id);
    const moved = await api("PATCH", `${S}/${site.id}`, { token: owner.token, body: { client_id: a.id, name: "Renamed" } });
    expect(moved.status).toBe(200);
    expect(moved.body.data).toEqual(expect.objectContaining({ client_id: a.id, name: "Renamed" }));
    const ungrouped = await api("PATCH", `${S}/${site.id}`, { token: owner.token, body: { client_id: null } });
    expect(ungrouped.body.data.client_id).toBeNull();
    expect((await api("PATCH", `${S}/${site.id}`, { token: owner.token, body: { client_id: "abc" } })).status).toBe(400);
  });

  it("is owner-only: an admin member of the site gets 404 for it", async () => {
    const owner = await seedUser();
    const admin = await seedUser();
    const site = await seedWebsite(owner.id);
    await addMember(site.id, admin.id, "admin");
    expect((await api("GET", `${S}/${site.id}`, { token: admin.token })).status).toBe(404);
    expect((await api("PATCH", `${S}/${site.id}`, { token: admin.token, body: { name: "x" } })).status).toBe(404);
    expect((await api("DELETE", `${S}/${site.id}`, { token: admin.token })).status).toBe(404);
    expect((await api("GET", S, { token: admin.token })).body.data).toEqual([]);
    expect(await sql`SELECT 1 FROM websites WHERE id = ${site.id}::uuid`).toHaveLength(1);
  });

  it("deletes a site with its data", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    await sql`INSERT INTO goals (website_id, name, type, identifier) VALUES (${site.id}::uuid, 'g', 'pageview', '/x')`;
    expect((await api("DELETE", `${S}/${site.id}`, { token: owner.token })).status).toBe(204);
    expect(await sql`SELECT 1 FROM websites WHERE id = ${site.id}::uuid`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM goals WHERE website_id = ${site.id}::uuid`).toHaveLength(0);
    expect((await api("DELETE", `${S}/${site.id}`, { token: owner.token })).status).toBe(404);
  });

  it("rejects a create with no name or address", async () => {
    const owner = await seedUser();
    for (const body of [{}, { name: "x" }, { url: "x.test" }, { name: "x", url: "x.test", client_id: "nope" }]) {
      expect((await api("POST", S, { token: owner.token, body })).status).toBe(400);
    }
  });

  it("answers a malformed website id with 404", async () => {
    const owner = await seedUser();
    expect((await api("GET", `${S}/not-a-uuid`, { token: owner.token })).status).toBe(404);
    expect((await api("GET", `${S}/${randomUUID()}`, { token: owner.token })).status).toBe(404);
  });

  it("an address that cannot be parsed is a 400", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    expect((await api("PATCH", `${S}/${site.id}`, { token: owner.token, body: { url: "http://" } })).status).toBe(400);
    expect((await api("POST", S, { token: owner.token, body: { name: "x", url: "http://" } })).status).toBe(400);
  });
});
