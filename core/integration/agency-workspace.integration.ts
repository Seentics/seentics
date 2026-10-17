import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { api, application, seedUser, seedWebsite, sql } from "./harness";
import { agencyApi, fileUnderClient, seedClient, seedEvents } from "./helpers/identity";

/**
 * The agency workspace API against the real database: migration 070's tables and columns,
 * the repositories' SQL (cursor paging, search, detach-on-delete), the slug's unique index,
 * and the analytics reads behind install verification and the overview.
 */

const newClient = async (ownerId: string, body: Record<string, unknown> = { name: "Acme" }) => {
  const res = await agencyApi("POST", "/clients", ownerId, body);
  expect(res.status).toBe(201);
  return res.body.data as { id: string; name: string };
};

describe("migration 070", () => {
  it("has the workspace's tables and columns", async () => {
    const cols = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('clients', 'client_members', 'agency_alerts', 'agency_white_label')`;
    const has = (t: string, c: string) => cols.some((r) => r.table_name === t && r.column_name === c);
    expect(has("clients", "collect_features")).toBe(true);
    expect(has("clients", "dashboard_features")).toBe(true);
    expect(has("clients", "features_enabled")).toBe(false);
    expect(has("clients", "limits")).toBe(true);
    expect(has("client_members", "user_id")).toBe(true);
    expect(has("agency_alerts", "dismissed_at")).toBe(true);
    expect(has("agency_white_label", "slug")).toBe(true);
  });

  it("refuses an unknown client status, and a duplicate alert even with NULL targets", async () => {
    const owner = await seedUser();
    const refused = await sql`INSERT INTO clients (user_id, name, status) VALUES (${owner.id}::uuid, 'x', 'deleted')`.then(() => false, () => true);
    expect(refused).toBe(true);
    await sql`INSERT INTO agency_alerts (owner_id, kind, period) VALUES (${owner.id}::uuid, 'tracking_stopped', '2026-10-16')`;
    const again = await sql`INSERT INTO agency_alerts (owner_id, kind, period) VALUES (${owner.id}::uuid, 'tracking_stopped', '2026-10-16')
                            ON CONFLICT ON CONSTRAINT ux_agency_alerts_once DO NOTHING RETURNING id`;
    expect(again).toHaveLength(0);
  });
});

describe("gateway trust", () => {
  it("refuses the agency API without the gateway's key", async () => {
    const owner = await seedUser();
    const res = await api("GET", "/api/v1/agency/clients", { headers: { "X-Agency-Owner": owner.id } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("no longer serves the old dashboard agency routes, except API keys", async () => {
    const owner = await seedUser();
    for (const path of ["/clients", "/websites", "/embed-links", "/white-label", "/client-users"]) {
      expect({ path, status: (await api("GET", `/api/v1/user/agency${path}`, { token: owner.token })).status }).toEqual({ path, status: 404 });
    }
    expect((await api("GET", "/api/v1/user/agency/api-keys", { token: owner.token })).status).toBe(200);
    expect((await api("POST", "/api/v1/agency/portal/validate", { body: { token: "scp_x" } })).status).toBe(401);
  });
});

describe("clients", () => {
  it("pages by cursor, newest first, and searches name and company with LIKE wildcards literal", async () => {
    const owner = await seedUser();
    for (const name of ["Alpha", "Beta", "Gamma"]) await newClient(owner.id, { name });
    await newClient(owner.id, { name: "Delta", company: "100% Agency" });
    const first = await agencyApi("GET", "/clients?limit=3", owner.id);
    expect(first.body.data.map((c: { name: string }) => c.name)).toEqual(["Delta", "Gamma", "Beta"]);
    const rest = await agencyApi("GET", `/clients?limit=3&cursor=${first.body.page.next_cursor}`, owner.id);
    expect(rest.body.data.map((c: { name: string }) => c.name)).toEqual(["Alpha"]);
    expect(rest.body.page).toEqual({ next_cursor: null, has_more: false });
    expect((await agencyApi("GET", `/clients?q=${encodeURIComponent("0%")}`, owner.id)).body.data.map((c: { name: string }) => c.name)).toEqual(["Delta"]);
    expect((await agencyApi("GET", "/clients?q=%25", owner.id)).body.data).toHaveLength(1);
  });

  it("archiving stops the client's sites collecting; unarchiving resumes it", async () => {
    const owner = await seedUser();
    const c = await newClient(owner.id);
    const site = await seedWebsite(owner.id);
    await fileUnderClient(site.id, c.id);
    const trackers = application().modules.websites.trackerWebsites;
    await agencyApi("POST", `/clients/${c.id}/archive`, owner.id);
    expect((await trackers.resolve(site.id))?.is_active).toBe(false);
    await agencyApi("POST", `/clients/${c.id}/unarchive`, owner.id);
    expect((await trackers.resolve(site.id))?.is_active).toBe(true);
  });

  it("collect_features switch a feature off for the client's sites", async () => {
    const owner = await seedUser();
    const c = await newClient(owner.id);
    const site = await seedWebsite(owner.id);
    await fileUnderClient(site.id, c.id);
    await agencyApi("PATCH", `/clients/${c.id}`, owner.id, { collect_features: { replays: false } });
    const [row] = await sql<{ collect_features: Record<string, boolean> }[]>`SELECT collect_features FROM clients WHERE id = ${c.id}::uuid`;
    expect(row!.collect_features).toEqual({ replays: false });
    expect((await application().modules.websites.trackerWebsites.resolve(site.id))?.replay_enabled).toBe(false);
  });

  it("deletes with confirm=true and detaches its websites", async () => {
    const owner = await seedUser();
    const c = await newClient(owner.id);
    const site = (await agencyApi("POST", `/clients/${c.id}/websites`, owner.id, { name: "Shop", url: "www.Shop-One.test" })).body.data.website;
    expect(site.url).toBe("shop-one.test");
    expect((await agencyApi("DELETE", `/clients/${c.id}`, owner.id)).status).toBe(422);
    expect((await agencyApi("DELETE", `/clients/${c.id}?confirm=true`, owner.id)).status).toBe(204);
    const [row] = await sql<{ client_id: string | null }[]>`SELECT client_id::text FROM websites WHERE id = ${site.id}::uuid`;
    expect(row!.client_id).toBeNull();
  });

  it("stores the feature matrix without the offs", async () => {
    const owner = await seedUser();
    const c = await newClient(owner.id);
    await agencyApi("PUT", `/clients/${c.id}/features`, owner.id, { features: { overview: "view", goals: "edit", revenue: "off" } });
    const [row] = await sql<{ dashboard_features: Record<string, string> }[]>`SELECT dashboard_features FROM clients WHERE id = ${c.id}::uuid`;
    expect(row!.dashboard_features).toEqual({ overview: "view", goals: "edit" });
  });

  it("reads another agency's client as not found", async () => {
    const owner = await seedUser();
    const theirs = await seedClient((await seedUser()).id);
    expect((await agencyApi("GET", `/clients/${theirs}`, owner.id)).status).toBe(404);
  });
});

describe("websites", () => {
  it("filters unassigned and by client, and moves a site between clients", async () => {
    const owner = await seedUser();
    const a = await newClient(owner.id, { name: "A" });
    const b = await newClient(owner.id, { name: "B" });
    const site = (await agencyApi("POST", "/websites", owner.id, { name: "S", url: "s-move.test", client_id: a.id })).body.data;
    const loose = (await agencyApi("POST", "/websites", owner.id, { name: "L", url: "loose.test" })).body.data;
    expect((await agencyApi("GET", "/websites?unassigned=true", owner.id)).body.data.map((s: { id: string }) => s.id)).toEqual([loose.id]);
    await agencyApi("PATCH", `/websites/${site.id}`, owner.id, { client_id: b.id });
    expect((await agencyApi("GET", `/websites?client_id=${b.id}`, owner.id)).body.data.map((s: { id: string }) => s.id)).toEqual([site.id]);
  });

  it("verifies from real events and records the first sighting", async () => {
    const owner = await seedUser();
    const site = (await agencyApi("POST", "/websites", owner.id, { name: "V", url: "verify-me.test" })).body.data;
    expect((await agencyApi("GET", `/websites/${site.id}/install`, owner.id)).body.data.verification.status).toBe("not_seen");
    await seedEvents(site.id, ["/", "/pricing"]);
    await sql`INSERT INTO analytics_event_counts (website_id, day, events) VALUES (${site.id}, (now() AT TIME ZONE 'UTC')::date, 2)`;
    const v = await agencyApi("POST", `/websites/${site.id}/verify`, owner.id);
    expect(v.body.data).toMatchObject({ status: "receiving", is_verified: true, events_24h: 2 });
    const [row] = await sql<{ is_verified: boolean }[]>`SELECT is_verified FROM websites WHERE id = ${site.id}::uuid`;
    expect(row!.is_verified).toBe(true);
  });
});

describe("branding", () => {
  it("holds a slug for one agency only", async () => {
    const a = await seedUser();
    const b = await seedUser();
    const slug = `agency-${randomUUID().slice(0, 8)}`;
    expect((await agencyApi("PUT", "/branding", a.id, { brand_name: "A", slug })).body.data.slug).toBe(slug);
    const taken = await agencyApi("PUT", "/branding", b.id, { slug });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("conflict");
  });
});

describe("overview, alerts and setup", () => {
  it("totals the agency's events per client", async () => {
    const owner = await seedUser();
    const c = await newClient(owner.id);
    const site = await seedWebsite(owner.id);
    await fileUnderClient(site.id, c.id);
    await seedEvents(site.id, ["/a", "/b", "/c"]);
    await sql`INSERT INTO analytics_event_counts (website_id, day, events) VALUES (${site.id}, (now() AT TIME ZONE 'UTC')::date, 3)`;
    const o = (await agencyApi("GET", "/overview?period=7d", owner.id)).body.data;
    expect(o.totals.events).toBe(3);
    expect(o.clients.find((r: { id: string }) => r.id === c.id).totals.events).toBe(3);
  });

  it("lists and dismisses the agency's alerts", async () => {
    const owner = await seedUser();
    const [alert] = await sql<{ id: string }[]>`
      INSERT INTO agency_alerts (owner_id, kind, resource, period) VALUES (${owner.id}::uuid, 'cap_80', 'events', '2026-10-01') RETURNING id::text`;
    expect((await agencyApi("GET", "/overview", owner.id)).body.data.alerts.map((a: { id: string }) => a.id)).toEqual([alert!.id]);
    expect((await agencyApi("POST", `/alerts/${alert!.id}/dismiss`, (await seedUser()).id)).status).toBe(404);
    expect((await agencyApi("POST", `/alerts/${alert!.id}/dismiss`, owner.id)).body.data.dismissed_at).not.toBeNull();
  });

  it("marks client_user done once a client has a member", async () => {
    const owner = await seedUser();
    const member = await seedUser();
    const c = await newClient(owner.id);
    const before = (await agencyApi("GET", "/setup", owner.id)).body.data.steps;
    expect(before.find((s: { id: string }) => s.id === "client_user").done).toBe(false);
    await sql`INSERT INTO client_members (client_id, user_id, owner_id) VALUES (${c.id}::uuid, ${member.id}::uuid, ${owner.id}::uuid)`;
    const after = (await agencyApi("GET", "/setup", owner.id)).body.data.steps;
    expect(after.find((s: { id: string }) => s.id === "client_user").done).toBe(true);
    expect(after.find((s: { id: string }) => s.id === "first_client").done).toBe(true);
  });
});
