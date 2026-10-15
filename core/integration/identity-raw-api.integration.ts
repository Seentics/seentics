import { describe, expect, it } from "bun:test";
import { addMember, api, seedUser, seedWebsite } from "./harness";
import { keyHeader, mintAccountKey, seedEvents, seedHeatmapClick, seedReplay } from "./helpers/identity";

const R = "/api/v1/raw/v1/websites";

async function siteWithKey(scopes?: string[]) {
  const user = await seedUser();
  const site = await seedWebsite(user.id);
  const { key } = await mintAccountKey(user, scopes);
  return { user, site, headers: keyHeader(key) };
}

describe("raw data API authentication", () => {
  it("serves the catalogue without a key", async () => {
    const res = await api("GET", "/api/v1/raw/v1/catalogue");
    expect(res.status).toBe(200);
    expect(res.body.meta.count).toBe(res.body.data.length);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("needs a key on every data route", async () => {
    const { site } = await siteWithKey();
    for (const path of ["analytics/events", "analytics/top-pages", "sessions", "heatmap/pages"]) {
      const res = await api("GET", `${R}/${site.id}/${path}`);
      expect({ path, status: res.status, code: res.body.code }).toEqual({ path, status: 401, code: "missing_api_key" });
    }
  });

  it("refuses a dashboard session, a website tracking id and a made-up key", async () => {
    const { user, site } = await siteWithKey();
    for (const headers of [
      { Authorization: `Bearer ${user.token}` },
      keyHeader(site.trackingId),
      keyHeader("snt_acct_made_up_key_value"),
    ]) {
      const res = await api("GET", `${R}/${site.id}/analytics/events`, { headers });
      expect(res.status).toBe(401);
    }
  });

  it("refuses a key on another account's site with the same answer as a bad key", async () => {
    const a = await siteWithKey();
    const b = await siteWithKey();
    await seedEvents(b.site.id, ["/secret"]);

    const res = await api("GET", `${R}/${b.site.id}/analytics/events`, { headers: a.headers });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("invalid_api_key");
    expect(res.text).not.toContain("/secret");
  });

  it("refuses the key of a member who does not own the site", async () => {
    // The data API is the owner's: a member's key reads only sites that member owns.
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const member = await seedUser();
    await addMember(site.id, member.id, "admin");
    const { key } = await mintAccountKey(member);

    expect((await api("GET", `${R}/${site.id}/analytics/events`, { headers: keyHeader(key) })).status).toBe(401);
  });

  it("answers a malformed or unknown website id like a refused key", async () => {
    const { headers } = await siteWithKey();
    expect((await api("GET", `${R}/not-a-uuid/analytics/events`, { headers })).status).toBe(401);
    expect((await api("GET", `${R}/00000000-0000-0000-0000-000000000000/analytics/events`, { headers })).status).toBe(401);
  });
});

describe("raw data API scopes", () => {
  it("lets each data scope read only its own kind of data", async () => {
    const analytics = await siteWithKey(["analytics:read"]);
    expect((await api("GET", `${R}/${analytics.site.id}/analytics/events`, { headers: analytics.headers })).status).toBe(200);
    const denied = await api("GET", `${R}/${analytics.site.id}/sessions`, { headers: analytics.headers });
    expect(denied.status).toBe(403);
    expect(denied.body.required_scope).toBe("replays:read");
    expect((await api("GET", `${R}/${analytics.site.id}/heatmap/pages`, { headers: analytics.headers })).status).toBe(403);

    const replays = await siteWithKey(["replays:read"]);
    expect((await api("GET", `${R}/${replays.site.id}/sessions`, { headers: replays.headers })).status).toBe(200);
    expect((await api("GET", `${R}/${replays.site.id}/analytics/top-pages`, { headers: replays.headers })).status).toBe(403);

    const heatmaps = await siteWithKey(["heatmaps:read"]);
    expect((await api("GET", `${R}/${heatmaps.site.id}/heatmap/pages`, { headers: heatmaps.headers })).status).toBe(200);
    expect((await api("GET", `${R}/${heatmaps.site.id}/analytics/events`, { headers: heatmaps.headers })).status).toBe(403);
  });

  it("gives a management-only key no data at all", async () => {
    const { site, headers } = await siteWithKey(["websites:read", "websites:write"]);
    for (const path of ["analytics/events", "analytics/dashboard", "sessions", "heatmap/pages"]) {
      const res = await api("GET", `${R}/${site.id}/${path}`, { headers });
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
    }
  });
});

describe("raw events", () => {
  it("returns the site's events newest first, and nobody else's", async () => {
    const { site, headers } = await siteWithKey();
    const other = await siteWithKey();
    const old = await seedEvents(site.id, ["/old"], { at: new Date(Date.now() - 3_600_000) });
    const recent = await seedEvents(site.id, ["/a", "/b"]);
    await seedEvents(other.site.id, ["/not-mine"]);

    const res = await api("GET", `${R}/${site.id}/analytics/events`, { headers });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ website_id: site.id, limit: 100, offset: 0, returned: 3 });
    expect(res.body.events.at(-1)).toMatchObject({ page: "/old", visitor_id: old.visitorId, event_type: "pageview", properties: { k: "v" } });
    expect(res.body.events.slice(0, 2).map((e: { page: string }) => e.page).sort()).toEqual(["/a", "/b"]);
    expect(res.body.events[0].session_id).toBe(recent.sessionId);
    expect(res.text).not.toContain("/not-mine");
  });

  it("filters by time window and event type, and pages without overlap", async () => {
    const { site, headers } = await siteWithKey();
    await seedEvents(site.id, ["/old"], { at: new Date(Date.now() - 2 * 3_600_000) });
    await seedEvents(site.id, ["/1", "/2", "/3"]);
    await seedEvents(site.id, ["/signup"], { eventType: "signup" });

    const windowed = await api("GET", `${R}/${site.id}/analytics/events`, {
      headers,
      query: { from: new Date(Date.now() - 3_600_000).toISOString(), event_type: "pageview" },
    });
    expect(windowed.body.events.map((e: { page: string }) => e.page).sort()).toEqual(["/1", "/2", "/3"]);

    const before = await api("GET", `${R}/${site.id}/analytics/events`, { headers, query: { to: new Date(Date.now() - 3_600_000).toISOString() } });
    expect(before.body.events.map((e: { page: string }) => e.page)).toEqual(["/old"]);

    const p1 = await api("GET", `${R}/${site.id}/analytics/events`, { headers, query: { limit: 2 } });
    const p2 = await api("GET", `${R}/${site.id}/analytics/events`, { headers, query: { limit: 2, offset: 2 } });
    const p3 = await api("GET", `${R}/${site.id}/analytics/events`, { headers, query: { limit: 2, offset: 4 } });
    const ids = [...p1.body.events, ...p2.body.events, ...p3.body.events].map((e: { id: string }) => e.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it("refuses a bad date, a limit out of range and an oversize event type", async () => {
    const { site, headers } = await siteWithKey();
    for (const query of <Record<string, string | number>[]>[{ from: "yesterday-ish" }, { to: "nope" }, { limit: 0 }, { limit: 1001 }, { offset: -1 }, { event_type: "e".repeat(129) }]) {
      const res = await api("GET", `${R}/${site.id}/analytics/events`, { headers, query });
      expect({ query, status: res.status }).toEqual({ query, status: 400 });
    }
  });
});

describe("raw analytics read models", () => {
  it("answers every analytics read for the key's site", async () => {
    const { site, headers } = await siteWithKey(["analytics:read"]);
    await seedEvents(site.id, ["/pricing", "/pricing", "/"]);
    for (const name of [
      "dashboard", "traffic-summary", "activity-trends", "top-pages", "top-referrers", "top-sources",
      "top-countries", "top-browsers", "top-devices", "top-os", "top-resolutions", "top-languages",
      "top-cities", "hourly-stats", "daily-stats", "goals-stats", "custom-events", "visitor-insights",
      "geolocation-breakdown", "live-visitors", "path-analysis", "page-utm-breakdown", "export",
    ]) {
      const res = await api("GET", `${R}/${site.id}/analytics/${name}`, { headers, query: { days: 7 } });
      expect({ name, status: res.status }).toEqual({ name, status: 200 });
      expect(res.body.meta.website_id).toBe(site.id);
    }
  });

  it("counts the seeded pageviews in top pages and the traffic summary", async () => {
    const { site, headers } = await siteWithKey(["analytics:read"]);
    const other = await siteWithKey();
    await seedEvents(site.id, ["/pricing", "/pricing", "/"]);
    await seedEvents(other.site.id, ["/pricing", "/pricing", "/pricing"]);

    const pages = await api("GET", `${R}/${site.id}/analytics/top-pages`, { headers, query: { days: 7 } });
    expect(pages.body.data.top_pages).toEqual([
      { page: "/pricing", views: 2, unique: 1 },
      { page: "/", views: 1, unique: 1 },
    ]);
    const summary = await api("GET", `${R}/${site.id}/analytics/traffic-summary`, { headers, query: { days: 7 } });
    expect(summary.body.data).toMatchObject({ website_id: site.id, total_views: 3, total_visitors: 1 });
  });

  it("refuses an unknown analytics read", async () => {
    const { site, headers } = await siteWithKey();
    expect((await api("GET", `${R}/${site.id}/analytics/delete-everything`, { headers })).status).toBe(404);
  });
});

describe("raw sessions and heatmaps", () => {
  it("lists the site's recorded sessions and nobody else's", async () => {
    const { site, headers } = await siteWithKey();
    const other = await siteWithKey();
    const sessionId = await seedReplay(site.id);
    await seedReplay(other.site.id);

    const res = await api("GET", `${R}/${site.id}/sessions`, { headers });

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ website_id: site.id, limit: 50, offset: 0 });
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0]).toMatchObject({ session_id: sessionId, website_id: site.id, entry_page: "/pricing", duration_seconds: 42, pages_viewed: 3 });
    expect((await api("GET", `${R}/${site.id}/sessions`, { headers, query: { limit: 501 } })).status).toBe(400);
  });

  it("lists heatmap pages and returns one page's points", async () => {
    const { site, headers } = await siteWithKey();
    const other = await siteWithKey();
    await seedHeatmapClick(site.id, "/landing");
    await seedHeatmapClick(other.site.id, "/theirs");

    const pages = await api("GET", `${R}/${site.id}/heatmap/pages`, { headers });
    expect(pages.status).toBe(200);
    expect(pages.body.pages.map((p: { page_path: string }) => p.page_path)).toEqual(["/landing"]);

    const points = await api("GET", `${R}/${site.id}/heatmap/points`, { headers, query: { page_path: "/landing" } });
    expect(points.status).toBe(200);
    expect(points.body.meta).toEqual({ website_id: site.id, page_path: "/landing", event_type: "click" });
    expect(points.body.points.length).toBeGreaterThan(0);

    const theirs = await api("GET", `${R}/${site.id}/heatmap/points`, { headers, query: { page_path: "/theirs" } });
    expect(theirs.body.points).toEqual([]);
  });

  it("needs a page_path for heatmap points", async () => {
    const { site, headers } = await siteWithKey();
    expect((await api("GET", `${R}/${site.id}/heatmap/points`, { headers })).status).toBe(400);
    expect((await api("GET", `${R}/${site.id}/heatmap/points`, { headers, query: { page_path: "/".repeat(2049) } })).status).toBe(400);
  });
});
