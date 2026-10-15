/**
 * `/api/v1/internal/*`: server-to-server collectors and operator controls behind the
 * global API key. Config is read per request, so setting the key here is enough.
 */
import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { addMember, api, seedUser, seedWebsite, sql } from "./harness";
import { collect, drainAnalytics, pageview, sid } from "./helpers/ingest";

const KEY = "internal-test-key-0123456789abcdef";
process.env.GLOBAL_API_KEY = KEY;

const internal = (method: string, path: string, opts: { body?: unknown; query?: Record<string, string>; key?: string | null } = {}) =>
  api(method, `/api/v1/internal${path}`, {
    body: opts.body,
    query: opts.query,
    headers: opts.key === null ? {} : { "X-API-Key": opts.key ?? KEY },
  });

describe("the global API key", () => {
  it("is required on every internal route", async () => {
    const routes: [string, string][] = [
      ["GET", "/system/stats"], ["GET", "/website-owner?website_id=x"], ["GET", "/website-access"],
      ["POST", "/collect/analytics"], ["POST", "/collect/replay-events"], ["POST", "/collect/heatmap-events"],
      ["POST", "/retention-cleanup"], ["PUT", `/websites/${randomUUID()}/active`], ["GET", "/user-resource-counts"],
    ];
    for (const [method, path] of routes) {
      const missing = await internal(method, path, { key: null, body: {} });
      const wrong = await internal(method, path, { key: "x".repeat(KEY.length), body: {} });
      const prefix = await internal(method, path, { key: KEY.slice(0, -1), body: {} });
      expect([path, missing.status, wrong.status, prefix.status]).toEqual([path, 401, 401, 401]);
    }
  });

  it("lets the right key through", async () => {
    const res = await internal("GET", "/system/stats");
    expect(res.status).toBe(200);
  });
});

describe("POST /internal/collect/analytics", () => {
  it("queues events through the same pipeline as the tracker", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const s = sid();

    const res = await internal("POST", "/collect/analytics", {
      body: {
        website_id: site.trackingId,
        events: [
          { type: "pageview", url: "https://srv.test/a", sid: s, vid: "srv-visitor", ts: Date.now() - 1000 },
          { type: "custom", url: "https://srv.test/a", sid: s, vid: "srv-visitor", data: { name: "server_signup" } },
        ],
      },
    });

    expect(res.status).toBe(204);
    await drainAnalytics(site.id);
    const rows = await sql<{ event_type: string; visitor_id: string }[]>`
      SELECT event_type, visitor_id FROM analytics_events WHERE website_id = ${site.id} ORDER BY event_type`;
    expect([...rows]).toEqual([
      { event_type: "pageview", visitor_id: "srv-visitor" },
      { event_type: "server_signup", visitor_id: "srv-visitor" },
    ]);
    // And marks the day for the rollups like any other write.
    expect(await sql`SELECT 1 FROM analytics_rollup_stale WHERE website_id = ${site.id}`).toHaveLength(1);
  });

  it("answers 404 for an unknown website and 400 without one", async () => {
    const unknown = await internal("POST", "/collect/analytics", { body: { website_id: "trk_nobody", events: [] } });
    const missing = await internal("POST", "/collect/analytics", { body: { events: [] } });
    const notArray = await internal("POST", "/collect/analytics", { body: { website_id: "trk_x", events: "nope" } });
    expect(unknown.status).toBe(404);
    expect(missing.status).toBe(400);
    expect(notArray.status).toBe(400);
  });
});

describe("POST /internal/collect/replay-events and heatmap-events", () => {
  it("rejects an empty or missing event list", async () => {
    for (const path of ["/collect/replay-events", "/collect/heatmap-events"]) {
      const empty = await internal("POST", path, { body: { events: [] } });
      const missing = await internal("POST", path, { body: {} });
      const notObjects = await internal("POST", path, { body: { events: [1, 2] } });
      expect([path, empty.status, missing.status, notObjects.status]).toEqual([path, 400, 400, 400]);
    }
  });
});

describe("website lookups for peer services", () => {
  it("names a website's owner, by UUID or tracking id", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    for (const ref of [site.id, site.trackingId]) {
      const res = await internal("GET", "/website-owner", { query: { website_id: ref } });
      expect(res.body).toEqual({ data: { user_id: owner.id } });
    }
    expect((await internal("GET", "/website-owner", { query: { website_id: "trk_nobody" } })).body).toEqual({ data: null });
    expect((await internal("GET", "/website-owner")).status).toBe(400);
  });

  it("answers a user's role on a site, null for an outsider, and null data for no site", async () => {
    const owner = await seedUser();
    const viewer = await seedUser();
    const outsider = await seedUser();
    const site = await seedWebsite(owner.id);
    await addMember(site.id, viewer.id, "viewer");
    const ask = (userId: string, websiteId = site.id) => internal("GET", "/website-access", { query: { website_id: websiteId, user_id: userId } });

    expect((await ask(owner.id)).body.data).toMatchObject({ owner_id: owner.id, role: "owner" });
    expect((await ask(viewer.id)).body.data).toMatchObject({ owner_id: owner.id, role: "viewer" });
    expect((await ask(outsider.id)).body.data).toMatchObject({ owner_id: owner.id, role: null });
    expect((await ask(owner.id, randomUUID())).body).toEqual({ data: null });
    expect((await internal("GET", "/website-access", { query: { website_id: site.id } })).status).toBe(400);
  });
});

describe("PUT /internal/websites/:id/active", () => {
  it("switches a site's tracking off, so the tracker is refused, and back on", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);

    const off = await internal("PUT", `/websites/${site.id}/active`, { body: { active: false } });
    expect(off.body).toEqual({ data: { websiteId: site.id, active: false } });
    expect((await collect(site, { consent: true, events: [pageview({ sid: sid() })] })).status).toBe(404);

    await internal("PUT", `/websites/${site.id}/active`, { body: { active: true } });
    expect((await collect(site, { consent: true, events: [pageview({ sid: sid() })] })).status).toBe(200);
    const [row] = await sql<{ is_active: boolean }[]>`SELECT is_active FROM websites WHERE id = ${site.id}::uuid`;
    expect(row!.is_active).toBe(true);
  });

  it("wants a boolean and an existing site", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    expect((await internal("PUT", `/websites/${site.id}/active`, { body: { active: "no" } })).status).toBe(400);
    expect((await internal("PUT", `/websites/${randomUUID()}/active`, { body: { active: false } })).status).toBe(404);
  });
});

describe("GET /internal/user-resource-counts", () => {
  it("counts a user's resources and wants a user id", async () => {
    const owner = await seedUser();
    await seedWebsite(owner.id);
    const res = await internal("GET", "/user-resource-counts", { query: { user_id: owner.id } });
    expect(res.status).toBe(200);
    expect(typeof res.body.data).toBe("object");
    expect((await internal("GET", "/user-resource-counts")).status).toBe(400);
  });
});
