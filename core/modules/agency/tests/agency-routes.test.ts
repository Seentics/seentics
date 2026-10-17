import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "../../../app/tests/helpers/fake-db";
import { memoryEmbedLinks } from "../../../app/tests/helpers/memory-embed-links";
import { testConfig } from "../../../app/tests/helpers/test-config";
import type { Website } from "../../websites/interfaces";
import {
  FixedActivity,
  FixedMetrics,
  MemoryAlerts,
  MemoryClients,
  MemorySignals,
  MemoryWhiteLabel,
  makeSite,
  memorySiteWrites,
} from "./support/memory-workspace";

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);
mock.module("../../../config", () => ({ env: () => testConfig() }));

let mods: {
  createAgencyRoutes: typeof import("../routes").createAgencyRoutes;
  ClientService: typeof import("../../websites/services/client.service").ClientService;
  WhiteLabelService: typeof import("../services/white-label.service").WhiteLabelService;
  AgencyOverviewService: typeof import("../services/overview.service").AgencyOverviewService;
  AgencySetupService: typeof import("../services/setup.service").AgencySetupService;
  WebsiteVerificationService: typeof import("../services/verification.service").WebsiteVerificationService;
  periodWindows: typeof import("../services/overview.service").periodWindows;
};

beforeAll(async () => {
  const overview = await import("../services/overview.service");
  mods = {
    createAgencyRoutes: (await import("../routes")).createAgencyRoutes,
    ClientService: (await import("../../websites/services/client.service")).ClientService,
    WhiteLabelService: (await import("../services/white-label.service")).WhiteLabelService,
    AgencyOverviewService: overview.AgencyOverviewService,
    AgencySetupService: (await import("../services/setup.service")).AgencySetupService,
    WebsiteVerificationService: (await import("../services/verification.service")).WebsiteVerificationService,
    periodWindows: overview.periodWindows,
  };
});

const GATEWAY_KEY = "gw-global-key";
const OWNER = "99999999-9999-4999-8999-999999999999";
const OTHER = "88888888-8888-4888-8888-888888888888";
const MISSING = "77777777-7777-4777-8777-777777777777";
const NOW = Date.parse("2026-10-17T12:00:00Z");

let w: {
  routes: ReturnType<typeof import("../routes").createAgencyRoutes>;
  sites: Map<string, Website>;
  deleted: string[];
  alerts: MemoryAlerts;
  traffic: FixedMetrics;
  leads: FixedMetrics;
  activity: FixedActivity;
  signals: MemorySignals;
};

beforeEach(async () => {
  const sites = new Map<string, Website>();
  const deleted: string[] = [];
  const { reads, writes } = memorySiteWrites(sites, deleted);
  const clientService = new mods.ClientService(new MemoryClients(sites), reads, writes, () => {});
  const whiteLabel = new mods.WhiteLabelService(new MemoryWhiteLabel());
  const alerts = new MemoryAlerts();
  const traffic = new FixedMetrics(["visitors", "pageviews"]);
  const leads = new FixedMetrics(["leads"]);
  const activity = new FixedActivity();
  const signals = new MemorySignals();
  const routes = mods.createAgencyRoutes({
    clients: clientService,
    websites: clientService,
    whiteLabel,
    overview: new mods.AgencyOverviewService({ clients: clientService, websites: clientService, sources: [traffic, leads], alerts, now: () => NOW }),
    setup: new mods.AgencySetupService({ whiteLabel, clients: clientService, websites: clientService, activity, signals }),
    verification: new mods.WebsiteVerificationService({ websites: clientService, activity }),
    embedLinks: await memoryEmbedLinks(),
    urls: () => ({ scriptUrl: "https://cdn.seentics.test/t.js", frontendUrl: "https://app.seentics.test" }),
    config: () => ({ globalApiKey: GATEWAY_KEY }),
  });
  w = { routes, sites, deleted, alerts, traffic, leads, activity, signals };
});

type Json = Record<string, any>;

async function call(method: string, path: string, body?: unknown, opts: { owner?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    "X-API-Key": GATEWAY_KEY,
    "X-Agency-Owner": opts.owner ?? OWNER,
    "X-Agency-Actor": opts.owner ?? OWNER,
    "X-Agency-Pool": "events=1000000,recordings=5000,leads=1000,ai_analyses=100",
    "Content-Type": "application/json",
    ...opts.headers,
  };
  const res = await w.routes.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as Json, headers: res.headers };
}

const newClient = async (name = "Acme", owner = OWNER) => (await call("POST", "/clients", { name, company: `${name} Inc` }, { owner })).body.data;
const addSite = (owner: string, over: Partial<Website> = {}) => {
  const s = makeSite(owner, over);
  w.sites.set(s.id, s);
  return s;
};

function expectError(r: { status: number; body: Json }, status: number, code: string) {
  expect(r.status).toBe(status);
  expect(r.body.error.code).toBe(code);
  expect(typeof r.body.error.message).toBe("string");
  expect(typeof r.body.error.request_id).toBe("string");
}

describe("gateway trust", () => {
  it("refuses a request without the gateway's key, whatever X-Agency-Owner says", async () => {
    expectError(await call("GET", "/clients", undefined, { headers: { "X-API-Key": "" } }), 401, "unauthorized");
    expectError(await call("GET", "/clients", undefined, { headers: { "X-API-Key": "not-the-key" } }), 401, "unauthorized");
  });

  it("refuses a gateway request that names no agency, or names it badly", async () => {
    expectError(await call("GET", "/clients", undefined, { headers: { "X-Agency-Owner": "" } }), 401, "unauthorized");
    expectError(await call("GET", "/clients", undefined, { headers: { "X-Agency-Owner": "owner-1" } }), 401, "unauthorized");
    expectError(await call("GET", "/clients", undefined, { headers: { "X-Agency-Actor": "key:bad id!" } }), 401, "unauthorized");
  });

  it("accepts an account key as the actor", async () => {
    expect((await call("GET", "/clients", undefined, { headers: { "X-Agency-Actor": "key:3f2a" } })).status).toBe(200);
  });

  it("refuses when the deployment has no gateway key at all", async () => {
    const routes = mods.createAgencyRoutes({ ...({} as Parameters<typeof mods.createAgencyRoutes>[0]), config: () => ({ globalApiKey: "" }) });
    const res = await routes.request("/clients", { headers: { "X-API-Key": "", "X-Agency-Owner": OWNER } });
    expect(res.status).toBe(401);
  });

  it("echoes the gateway's X-Request-ID in errors and headers, and makes one up otherwise", async () => {
    const r = await call("GET", `/clients/${MISSING}`, undefined, { headers: { "X-Request-ID": "req-123" } });
    expect(r.body.error.request_id).toBe("req-123");
    expect(r.headers.get("X-Request-ID")).toBe("req-123");
    const fresh = await call("GET", `/clients/${MISSING}`);
    expect(fresh.body.error.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("answers unknown paths in the envelope", async () => {
    expectError(await call("GET", "/portal/validate"), 404, "not_found");
  });
});

describe("clients", () => {
  it("creates a client in the envelope, with its fields", async () => {
    const r = await call("POST", "/clients", { name: "Acme", company: "Acme Inc", notes: "Retainer" });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ name: "Acme", company: "Acme Inc", notes: "Retainer", status: "active", website_count: 0, websites: [] });
    expect(r.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("refuses a nameless client with validation_failed and details", async () => {
    const r = await call("POST", "/clients", { name: "  " });
    expectError(r, 422, "validation_failed");
    expect(r.body.error.details.issues[0].path).toBe("name");
    expectError(await call("POST", "/clients", "{not json" as never), 422, "validation_failed");
  });

  it("pages newest first by cursor, with has_more and next_cursor", async () => {
    for (const n of ["one", "two", "three"]) await newClient(n);
    const first = await call("GET", "/clients?limit=2");
    expect(first.body.data.map((c: Json) => c.name)).toEqual(["three", "two"]);
    expect(first.body.page.has_more).toBe(true);
    expect(typeof first.body.page.next_cursor).toBe("string");
    const rest = await call("GET", `/clients?limit=2&cursor=${first.body.page.next_cursor}`);
    expect(rest.body.data.map((c: Json) => c.name)).toEqual(["one"]);
    expect(rest.body.page).toEqual({ next_cursor: null, has_more: false });
  });

  it("refuses a cursor it never issued, and a limit past 100", async () => {
    expectError(await call("GET", "/clients?cursor=bm9wZQ"), 422, "validation_failed");
    expectError(await call("GET", "/clients?limit=101"), 422, "validation_failed");
  });

  it("defaults to 25 per page", async () => {
    for (let i = 0; i < 26; i++) await newClient(`c${i}`);
    const r = await call("GET", "/clients");
    expect(r.body.data).toHaveLength(25);
    expect(r.body.page.has_more).toBe(true);
  });

  it("filters by status and search", async () => {
    const a = await newClient("Alpha");
    await newClient("Beta");
    await call("POST", `/clients/${a.id}/archive`);
    expect((await call("GET", "/clients?status=archived")).body.data.map((c: Json) => c.name)).toEqual(["Alpha"]);
    expect((await call("GET", "/clients?status=active")).body.data.map((c: Json) => c.name)).toEqual(["Beta"]);
    expect((await call("GET", "/clients?q=bet")).body.data.map((c: Json) => c.name)).toEqual(["Beta"]);
  });

  it("never shows or changes another agency's client", async () => {
    const theirs = await newClient("Theirs", OTHER);
    expect((await call("GET", "/clients")).body.data).toEqual([]);
    expectError(await call("GET", `/clients/${theirs.id}`), 404, "not_found");
    expectError(await call("PATCH", `/clients/${theirs.id}`, { name: "x" }), 404, "not_found");
    expectError(await call("POST", `/clients/${theirs.id}/archive`), 404, "not_found");
    expectError(await call("DELETE", `/clients/${theirs.id}?confirm=true`), 404, "not_found");
    expectError(await call("GET", `/clients/${theirs.id}/websites`), 404, "not_found");
    expectError(await call("POST", `/clients/${theirs.id}/websites`, { name: "s", url: "s.example" }), 404, "not_found");
    expectError(await call("GET", `/clients/${theirs.id}/features`), 404, "not_found");
    expectError(await call("GET", "/clients/not-a-uuid"), 404, "not_found");
    expect((await call("GET", `/clients/${theirs.id}`, undefined, { owner: OTHER })).status).toBe(200);
  });

  it("edits, archives and unarchives", async () => {
    const c = await newClient();
    const patched = await call("PATCH", `/clients/${c.id}`, { name: "Acme 2", notes: "n", collect_features: { replays: false } });
    expect(patched.body.data).toMatchObject({ name: "Acme 2", notes: "n" });
    expect(patched.body.data.collect_features.replays).toBe(false);
    expectError(await call("PATCH", `/clients/${c.id}`, { status: "deleted" }), 422, "validation_failed");
    expectError(await call("PATCH", `/clients/${c.id}`, { collect_features: { nope: true } }), 422, "validation_failed");
    expect((await call("POST", `/clients/${c.id}/archive`)).body.data.status).toBe("archived");
    expect((await call("POST", `/clients/${c.id}/unarchive`)).body.data.status).toBe("active");
  });

  it("deletes only with confirm=true, keeping its websites in no client", async () => {
    const c = await newClient();
    const site = (await call("POST", `/clients/${c.id}/websites`, { name: "Shop", url: "shop.example" })).body.data.website;
    expectError(await call("DELETE", `/clients/${c.id}`), 422, "validation_failed");
    expectError(await call("DELETE", `/clients/${c.id}?confirm=yes`), 422, "validation_failed");
    expect((await call("GET", `/clients/${c.id}`)).status).toBe(200);

    expect((await call("DELETE", `/clients/${c.id}?confirm=true`)).status).toBe(204);
    expectError(await call("GET", `/clients/${c.id}`), 404, "not_found");
    const kept = await call("GET", `/websites/${site.id}`);
    expect(kept.body.data.client_id).toBeNull();
    expect(w.deleted).toEqual([]);
  });

  it("adds a website to a client and returns it with its install", async () => {
    const c = await newClient();
    const r = await call("POST", `/clients/${c.id}/websites`, { name: "Shop", url: "https://shop.example" });
    expect(r.status).toBe(201);
    expect(r.body.data.website).toMatchObject({ name: "Shop", client_id: c.id, is_verified: false });
    expect(r.body.data.install.website_id).toBe(r.body.data.website.id);
    expect(r.body.data.install.verification).toEqual({ status: "not_seen", is_verified: false, last_event_at: null, events_24h: 0 });
    expectError(await call("POST", `/clients/${c.id}/websites`, { name: "Bad", url: "http://" }), 422, "validation_failed");

    const list = await call("GET", `/clients/${c.id}/websites`);
    expect(list.body.data.map((s: Json) => s.name)).toEqual(["Shop"]);
    expect(list.body.page).toEqual({ next_cursor: null, has_more: false });
    expect((await call("GET", `/clients/${c.id}`)).body.data.website_count).toBe(1);
  });
});

describe("feature visibility", () => {
  it("starts with every page off and stores a valid matrix", async () => {
    const c = await newClient();
    const initial = await call("GET", `/clients/${c.id}/features`);
    expect(Object.keys(initial.body.data.features)).toHaveLength(14);
    expect(new Set(Object.values(initial.body.data.features))).toEqual(new Set(["off"]));

    const put = await call("PUT", `/clients/${c.id}/features`, { features: { overview: "view", goals: "edit", privacy: "view" } });
    expect(put.status).toBe(200);
    expect(put.body.data.features).toMatchObject({ overview: "view", goals: "edit", privacy: "view", revenue: "off" });
    // Replaced, not merged: a page left out goes back to off.
    const again = await call("PUT", `/clients/${c.id}/features`, { features: { revenue: "view" } });
    expect(again.body.data.features).toMatchObject({ overview: "off", goals: "off", revenue: "view" });
  });

  it("refuses unknown pages and access levels", async () => {
    const c = await newClient();
    expectError(await call("PUT", `/clients/${c.id}/features`, { features: { billing: "view" } }), 422, "validation_failed");
    expectError(await call("PUT", `/clients/${c.id}/features`, { features: { overview: "admin" } }), 422, "validation_failed");
    expectError(await call("PUT", `/clients/${c.id}/features`, {}), 422, "validation_failed");
  });
});

describe("websites", () => {
  it("creates, filters by client and unassigned, and searches", async () => {
    const c = await newClient();
    const inClient = await call("POST", "/websites", { name: "In", url: "in.example", client_id: c.id });
    expect(inClient.status).toBe(201);
    await call("POST", "/websites", { name: "Loose", url: "loose.example" });
    addSite(OTHER, { name: "Theirs" });
    expect((await call("GET", "/websites")).body.data.map((s: Json) => s.name)).toEqual(["Loose", "In"]);
    expect((await call("GET", `/websites?client_id=${c.id}`)).body.data.map((s: Json) => s.name)).toEqual(["In"]);
    expect((await call("GET", "/websites?unassigned=true")).body.data.map((s: Json) => s.name)).toEqual(["Loose"]);
    expect((await call("GET", "/websites?q=Loo")).body.data.map((s: Json) => s.name)).toEqual(["Loose"]);
  });

  it("refuses another agency's client as the home of a new site", async () => {
    const theirs = await newClient("Theirs", OTHER);
    expectError(await call("POST", "/websites", { name: "x", url: "x.example", client_id: theirs.id }), 404, "not_found");
    expectError(await call("POST", "/websites", { name: "x", url: "" }), 422, "validation_failed");
  });

  it("moves a website between clients and out of any", async () => {
    const a = await newClient("A");
    const b = await newClient("B");
    const site = (await call("POST", "/websites", { name: "S", url: "s.example", client_id: a.id })).body.data;
    expect((await call("PATCH", `/websites/${site.id}`, { client_id: b.id })).body.data.client_id).toBe(b.id);
    expect((await call("GET", `/clients/${b.id}/websites`)).body.data.map((s: Json) => s.id)).toEqual([site.id]);
    expect((await call("GET", `/clients/${a.id}/websites`)).body.data).toEqual([]);
    const out = await call("PATCH", `/websites/${site.id}`, { client_id: null, name: "Renamed" });
    expect(out.body.data).toMatchObject({ client_id: null, name: "Renamed" });
    const theirs = await newClient("Theirs", OTHER);
    expectError(await call("PATCH", `/websites/${site.id}`, { client_id: theirs.id }), 404, "not_found");
  });

  it("never shows, changes or deletes another agency's site", async () => {
    const theirs = addSite(OTHER);
    expectError(await call("GET", `/websites/${theirs.id}`), 404, "not_found");
    expectError(await call("PATCH", `/websites/${theirs.id}`, { name: "x" }), 404, "not_found");
    expectError(await call("DELETE", `/websites/${theirs.id}`), 404, "not_found");
    expectError(await call("GET", `/websites/${theirs.id}/install`), 404, "not_found");
    expectError(await call("POST", `/websites/${theirs.id}/verify`), 404, "not_found");
    expect(w.sites.has(theirs.id)).toBe(true);
  });

  it("deletes the agency's own site", async () => {
    const mine = addSite(OWNER);
    expect((await call("DELETE", `/websites/${mine.id}`)).status).toBe(204);
    expect(w.deleted).toEqual([mine.id]);
    expectError(await call("GET", `/websites/${mine.id}`), 404, "not_found");
  });
});

describe("install and verification", () => {
  it("hands out the snippet, per-platform steps with docs links, and not_seen for a silent site", async () => {
    const site = addSite(OWNER, { trackingId: "trk-1" });
    const r = await call("GET", `/websites/${site.id}/install`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      website_id: site.id,
      tracking_id: "trk-1",
      script_url: "https://cdn.seentics.test/t.js",
      snippet_html: `<script defer data-website-id="${site.id}" src="https://cdn.seentics.test/t.js"></script>`,
      verification: { status: "not_seen", is_verified: false, last_event_at: null, events_24h: 0 },
    });
    expect(Object.keys(r.body.data.instructions).sort()).toEqual(["gtm", "html", "nextjs", "npm", "shopify", "wordpress"]);
    expect(r.body.data.instructions.gtm.docs_url).toBe("https://app.seentics.test/docs/google-tag-manager");
    expect(r.body.data.instructions.wordpress.docs_url).toBe("https://app.seentics.test/docs/wordpress");
    expect(r.body.data.instructions.shopify.docs_url).toBe("https://app.seentics.test/docs/shopify");
    expect(r.body.data.instructions.npm.docs_url).toBe("https://app.seentics.test/docs/frameworks");
  });

  it("reads receiving and stale from tracker activity", async () => {
    const live = addSite(OWNER);
    const quiet = addSite(OWNER);
    w.activity.bySite.set(live.id, { lastEventAt: new Date("2026-10-17T11:59:00Z"), events24h: 42 });
    w.activity.bySite.set(quiet.id, { lastEventAt: new Date("2026-10-01T08:00:00Z"), events24h: 0 });
    expect((await call("GET", `/websites/${live.id}/install`)).body.data.verification).toEqual({
      status: "receiving", is_verified: true, last_event_at: "2026-10-17T11:59:00.000Z", events_24h: 42,
    });
    expect((await call("GET", `/websites/${quiet.id}/install`)).body.data.verification).toMatchObject({ status: "stale", is_verified: true, events_24h: 0 });
  });

  it("records the first sighting on the website when re-checked", async () => {
    const site = addSite(OWNER);
    expect((await call("POST", `/websites/${site.id}/verify`)).body.data.status).toBe("not_seen");
    expect(w.sites.get(site.id)!.isVerified).toBe(false);
    w.activity.bySite.set(site.id, { lastEventAt: new Date(NOW), events24h: 1 });
    const r = await call("POST", `/websites/${site.id}/verify`);
    expect(r.body.data).toMatchObject({ status: "receiving", is_verified: true, events_24h: 1 });
    expect(w.sites.get(site.id)!.isVerified).toBe(true);
    expect((await call("GET", `/websites/${site.id}`)).body.data.is_verified).toBe(true);
  });
});

describe("branding", () => {
  it("reads the defaults, then saves a partial update with a slug", async () => {
    const first = await call("GET", "/branding");
    expect(first.body.data).toMatchObject({ brand_name: "", primary_color: "#6366f1", slug: null, updated_at: null });
    const r = await call("PUT", "/branding", { brand_name: "North West", primary_color: "#ABC", slug: "North-West" });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ brand_name: "North West", primary_color: "#aabbcc", slug: "north-west" });
    expect((await call("PUT", "/branding", { footer_text: "Hi" })).body.data).toMatchObject({ brand_name: "North West", footer_text: "Hi", slug: "north-west" });
    expect((await call("PUT", "/branding", { slug: null })).body.data.slug).toBeNull();
  });

  it("answers a slug another agency holds with 409 conflict, and keeps its own", async () => {
    await call("PUT", "/branding", { slug: "taken-one" }, { owner: OTHER });
    expectError(await call("PUT", "/branding", { slug: "taken-one" }), 409, "conflict");
    expect((await call("GET", "/branding")).body.data.slug).toBeNull();
    expect((await call("PUT", "/branding", { slug: "taken-one" }, { owner: OTHER })).status).toBe(200);
  });

  it("refuses a malformed slug, logo or colour", async () => {
    for (const body of [{ slug: "ab" }, { slug: "has space" }, { slug: "x".repeat(41) }, { logo_url: "http://x.test/l.png" }, { primary_color: "red" }]) {
      expectError(await call("PUT", "/branding", body), 422, "validation_failed");
    }
  });
});

describe("embeds", () => {
  it("makes a link for the agency's own site or client, idempotently", async () => {
    const site = addSite(OWNER, { name: "Shop" });
    const first = await call("POST", "/embeds", { scope: "website", target_id: site.id, sections: ["analytics", "heatmaps"] });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ scope: "website", target_id: site.id, target_name: "Shop", sections: ["analytics", "heatmaps"] });
    expect((await call("POST", "/embeds", { scope: "website", target_id: site.id })).status).toBe(200);

    const c = await newClient();
    expect((await call("POST", "/embeds", { scope: "client", target_id: c.id })).status).toBe(201);
    const listed = await call("GET", "/embeds");
    expect(listed.body.data).toHaveLength(2);
    expect(listed.body.page).toEqual({ next_cursor: null, has_more: false });
    expect((await call("GET", "/embeds?scope=client")).body.data.map((e: Json) => e.target_id)).toEqual([c.id]);
  });

  it("refuses another agency's targets and links", async () => {
    const theirSite = addSite(OTHER);
    expectError(await call("POST", "/embeds", { scope: "website", target_id: theirSite.id }), 404, "not_found");
    expectError(await call("POST", "/embeds", { scope: "page", target_id: theirSite.id }), 422, "validation_failed");
    const theirLink = (await call("POST", "/embeds", { scope: "website", target_id: theirSite.id }, { owner: OTHER })).body.data;
    expect((await call("GET", "/embeds")).body.data).toEqual([]);
    expectError(await call("PATCH", `/embeds/${theirLink.id}`, { sections: ["analytics"] }), 404, "not_found");
    expectError(await call("DELETE", `/embeds/${theirLink.id}`), 404, "not_found");
  });

  it("changes sections in place and revokes", async () => {
    const site = addSite(OWNER);
    const link = (await call("POST", "/embeds", { scope: "website", target_id: site.id })).body.data;
    const patched = await call("PATCH", `/embeds/${link.id}`, { sections: ["recordings"] });
    expect(patched.body.data).toMatchObject({ id: link.id, sections: ["recordings"], embed_url: link.embed_url });
    expectError(await call("PATCH", `/embeds/${link.id}`, { sections: [] }), 422, "validation_failed");
    expect((await call("DELETE", `/embeds/${link.id}`)).status).toBe(204);
    expectError(await call("DELETE", `/embeds/${link.id}`), 404, "not_found");
    expect((await call("GET", "/embeds")).body.data).toEqual([]);
  });

  it("pages links by cursor", async () => {
    for (let i = 0; i < 3; i++) await call("POST", "/embeds", { scope: "website", target_id: addSite(OWNER).id });
    const first = await call("GET", "/embeds?limit=2");
    expect(first.body.data).toHaveLength(2);
    expect(first.body.page.has_more).toBe(true);
    const rest = await call("GET", `/embeds?limit=2&cursor=${first.body.page.next_cursor}`);
    expect(rest.body.data).toHaveLength(1);
    expect(new Set([...first.body.data, ...rest.body.data].map((e: Json) => e.id)).size).toBe(3);
  });
});

describe("overview", () => {
  it("totals every site per client and overall, against the previous period", async () => {
    const { current, previous } = mods.periodWindows("30d", NOW);
    const a = await newClient("A");
    const b = await newClient("B");
    const a1 = addSite(OWNER, { clientId: a.id, name: "a1" });
    const a2 = addSite(OWNER, { clientId: a.id, name: "a2" });
    const loose = addSite(OWNER, { name: "loose" });
    const theirs = addSite(OTHER, { name: "theirs" });
    w.traffic.set(current, a1.id, { visitors: 100, pageviews: 300 });
    w.traffic.set(current, a2.id, { visitors: 50, pageviews: 80 });
    w.traffic.set(current, loose.id, { visitors: 5, pageviews: 5 });
    w.traffic.set(current, theirs.id, { visitors: 9999, pageviews: 9999 });
    w.traffic.set(previous, a1.id, { visitors: 20, pageviews: 40 });
    w.traffic.set(previous, a2.id, { visitors: 50, pageviews: 50 });
    w.leads.set(current, a1.id, { leads: 3 });

    const r = await call("GET", "/overview?period=30d");
    expect(r.status).toBe(200);
    const o = r.body.data;
    expect(o.period).toEqual({ key: "30d", start: current.from, end: current.to, previous_start: previous.from, previous_end: previous.to });
    expect(o.period.end).toBe("2026-10-17");
    expect(o.totals).toEqual({ visitors: 155, pageviews: 385, leads: 3 });
    expect(o.previous_totals).toEqual({ visitors: 70, pageviews: 90, leads: 0 });
    // Only the owner's sites were asked about.
    expect(w.traffic.calls.every((call) => !call.ids.includes(theirs.id))).toBe(true);

    const byName = Object.fromEntries(o.clients.map((c: Json) => [c.name, c]));
    expect(byName.A).toMatchObject({ id: a.id, website_count: 2, totals: { visitors: 150, pageviews: 380, leads: 3 } });
    expect(byName.B).toMatchObject({ id: b.id, website_count: 0, totals: { visitors: 0, pageviews: 0, leads: 0 } });
    expect(byName.Unassigned).toMatchObject({ id: null, website_count: 1, totals: { visitors: 5 } });

    expect(o.top_movers.map((m: Json) => [m.website_name, m.current, m.previous, m.change_pct])).toEqual([
      ["a1", 100, 20, 400],
      ["loose", 5, 0, null],
    ]);
  });

  it("lists open alerts, and dismissing one removes it at once", async () => {
    const mine = w.alerts.add(OWNER, { kind: "cap_80", resource: "events", period: "2026-10-01" });
    const theirs = w.alerts.add(OTHER);
    const o = (await call("GET", "/overview")).body.data;
    expect(o.alerts.map((a: Json) => a.id)).toEqual([mine.id]);
    expect(o.alerts[0]).toMatchObject({ kind: "cap_80", resource: "events", period: "2026-10-01", dismissed_at: null });

    const dismissed = await call("POST", `/alerts/${mine.id}/dismiss`);
    expect(dismissed.status).toBe(200);
    expect(dismissed.body.data.dismissed_at).not.toBeNull();
    expect((await call("GET", "/overview")).body.data.alerts).toEqual([]);
    expectError(await call("POST", `/alerts/${theirs.id}/dismiss`), 404, "not_found");
    expectError(await call("POST", "/alerts/nope/dismiss"), 404, "not_found");
  });

  it("caches a minute per owner and period", async () => {
    addSite(OWNER);
    await call("GET", "/overview?period=7d");
    const calls = w.traffic.calls.length;
    await call("GET", "/overview?period=7d");
    expect(w.traffic.calls.length).toBe(calls);
    await call("GET", "/overview?period=90d");
    expect(w.traffic.calls.length).toBeGreaterThan(calls);
  });

  it("leaves out a failing source's metrics rather than failing the page", async () => {
    addSite(OWNER);
    w.leads.fail = true;
    const o = (await call("GET", "/overview")).body.data;
    expect(o.totals).toEqual({ visitors: 0, pageviews: 0 });
  });

  it("refuses an unknown period", async () => {
    expectError(await call("GET", "/overview?period=1y"), 422, "validation_failed");
  });
});

describe("setup", () => {
  const steps = async () => Object.fromEntries((await call("GET", "/setup")).body.data.steps.map((s: Json) => [s.id, s.done]));

  it("lists the five steps in order, none done for a new agency", async () => {
    const r = await call("GET", "/setup");
    expect(r.body.data.steps).toEqual([
      { id: "branding", done: false },
      { id: "first_client", done: false },
      { id: "website_installed", done: false },
      { id: "client_user", done: false },
      { id: "features_limits", done: false },
    ]);
  });

  it("marks each step from the agency's data", async () => {
    await call("PUT", "/branding", { brand_name: "NW" });
    const c = await newClient();
    const site = addSite(OWNER, { clientId: c.id });
    w.activity.bySite.set(site.id, { lastEventAt: new Date(NOW), events24h: 3 });
    w.signals.members.add(OWNER);
    await call("PUT", `/clients/${c.id}/features`, { features: { overview: "view" } });
    expect(await steps()).toEqual({ branding: true, first_client: true, website_installed: true, client_user: true, features_limits: true });
  });

  it("counts a live custom domain as branding, and a verified site as installed", async () => {
    w.signals.domains.set(OWNER, { hostname: "reports.agency.com", state: "active" });
    addSite(OWNER, { isVerified: true });
    expect(await steps()).toMatchObject({ branding: true, website_installed: true, first_client: false });
  });
});
