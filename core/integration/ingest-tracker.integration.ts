import { describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { api, seedUser, seedWebsite, sql, type SeededWebsite } from "./harness";
import { BROWSER_UA, collect, drainAnalytics, pageview, sid, siteHeaders } from "./helpers/ingest";

async function site(opts: { consentMode?: "cookieless" | "strict" | "none"; respectDnt?: boolean } = {}) {
  const owner = await seedUser();
  const s = await seedWebsite(owner.id);
  if (opts.consentMode || opts.respectDnt) {
    await sql`INSERT INTO website_privacy_settings (site_id, user_id, consent_mode, respect_dnt)
              VALUES (${s.id}, ${owner.id}::uuid, ${opts.consentMode ?? "cookieless"}, ${opts.respectDnt ?? false})`;
  }
  return { owner, site: s };
}

async function stored(s: SeededWebsite) {
  return sql<{ event_type: string; visitor_id: string; session_id: string; page: string; occurred_at: Date }[]>`
    SELECT event_type, visitor_id, session_id, page, occurred_at FROM analytics_events
    WHERE website_id = ${s.id} ORDER BY occurred_at, id`;
}

describe("GET /tracker/init and /tracker/config", () => {
  it("returns the site's public config, goals and the visitor's consent region", async () => {
    const { site: s } = await site();
    await sql`INSERT INTO goals (website_id, name, type, identifier) VALUES (${s.id}::uuid, 'Signup', 'event', 'signup')`;

    const res = await api("GET", `/api/v1/tracker/init/${s.trackingId}`, { headers: siteHeaders(s) });

    expect(res.status).toBe(200);
    expect(res.body.config.website_id).toBe(s.id);
    expect(res.body.config.consent_mode).toBe("cookieless");
    // CF-IPCountry: US is outside the consent region.
    expect(res.body.config.consent_region).toBe(false);
    expect(res.body.config.goals.map((g: { name: string }) => g.name)).toEqual(["signup"]);
    expect(Array.isArray(res.body.funnels)).toBe(true);
    expect(Array.isArray(res.body.automations)).toBe(true);
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("marks a visitor from the EU as in the consent region", async () => {
    const { site: s } = await site();
    const res = await api("GET", `/api/v1/tracker/init/${s.trackingId}`, { headers: siteHeaders(s, { "CF-IPCountry": "DE" }) });
    expect(res.body.config.consent_region).toBe(true);
  });

  it("accepts the site's UUID as well as its tracking id", async () => {
    const { site: s } = await site();
    const res = await api("GET", `/api/v1/tracker/config/${s.id}`, { headers: siteHeaders(s) });
    expect(res.status).toBe(200);
    expect(res.body.website_id).toBe(s.id);
    expect(res.body.consent_mode).toBe("cookieless");
  });

  it("refuses a page on another domain", async () => {
    const { site: s } = await site();
    for (const path of ["init", "config"]) {
      const res = await api("GET", `/api/v1/tracker/${path}/${s.trackingId}`, { headers: { Origin: "https://evil.example" } });
      expect(res.status).toBe(403);
    }
  });

  it("treats the www. host and a Referer as the site's own", async () => {
    const { site: s } = await site();
    const www = await api("GET", `/api/v1/tracker/config/${s.trackingId}`, { headers: { Origin: `https://www.${s.domain}` } });
    const ref = await api("GET", `/api/v1/tracker/config/${s.trackingId}`, { headers: { Referer: `https://${s.domain}/pricing` } });
    expect(www.status).toBe(200);
    expect(ref.status).toBe(200);
  });

  it("answers 404 for an unknown or inactive site", async () => {
    const { site: s } = await site();
    await sql`UPDATE websites SET is_active = false WHERE id = ${s.id}::uuid`;
    const inactive = await api("GET", `/api/v1/tracker/init/${s.trackingId}`, { headers: siteHeaders(s) });
    const unknown = await api("GET", `/api/v1/tracker/init/trk_doesnotexist`, { headers: siteHeaders(s) });
    expect(inactive.status).toBe(404);
    expect(unknown.status).toBe(404);
  });

  it("says no layout snapshot is needed for an unknown site rather than erroring", async () => {
    const res = await api("GET", `/api/v1/tracker/snapshot-needed/trk_nope`, { query: { path: "/" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ needed: false });
  });
});

describe("POST /tracker/collect", () => {
  it("stores pageviews and custom events with the request's device, browser and country", async () => {
    const { site: s } = await site();
    const session = sid();
    const t0 = Date.now() - 60_000;

    const res = await collect(s, {
      consent: true,
      events: [
        pageview({ sid: session, vid: "vis-1", url: `https://${s.domain}/`, ts: t0 }),
        pageview({ sid: session, vid: "vis-1", url: `https://${s.domain}/pricing`, ts: t0 + 1000 }),
        // seentics.track('signup') arrives as type 'custom' with the name in data.
        { type: "custom", sid: session, vid: "vis-1", url: "/pricing", ts: t0 + 2000, data: { name: "signup", plan: "pro" } },
      ],
    });

    expect(res.status).toBe(200);
    // queued counts every lane's rows (the visitor-profile lane takes one too), not just analytics.
    expect(res.body).toMatchObject({ status: "ok", message: "processed", dropped: 0 });
    expect(res.body.queued).toBeGreaterThanOrEqual(3);
    await drainAnalytics(s.id);
    const rows = await sql<{ event_type: string; visitor_id: string; country: string; device: string; browser: string; os: string }[]>`
      SELECT event_type, visitor_id, country, device, browser, os FROM analytics_events
      WHERE website_id = ${s.id} ORDER BY occurred_at`;
    expect(rows.map((r) => r.event_type)).toEqual(["pageview", "pageview", "signup"]);
    expect(rows[0]).toMatchObject({ visitor_id: "vis-1", country: "US", device: "Desktop" });
    expect(rows[0]!.browser).toStartWith("Chrome");
    expect(rows[0]!.os).toStartWith("macOS");
  });

  it("finds the site by UUID as well as tracking id", async () => {
    const { site: s } = await site();
    const res = await collect(s, { consent: true, events: [pageview({ sid: sid() })] }, { websiteRef: s.id });
    expect(res.body.message).toBe("processed");
    await drainAnalytics(s.id);
    expect(await stored(s)).toHaveLength(1);
  });

  it("stores a retried batch once, and a piece of an already stored batch not at all", async () => {
    const { site: s } = await site();
    const batchId = `b-${randomUUID()}`;
    const body = { consent: true, batch_id: batchId, events: [pageview({ sid: sid() })] };

    const first = await collect(s, body);
    const retry = await collect(s, body);
    // seentics.js flushBeacon resends a closing page's batches split into `<batch>#<n>`.
    const piece = await collect(s, { ...body, batch_id: `${batchId}#1` });

    expect(first.body.message).toBe("processed");
    expect(retry.body.message).toBe("duplicate");
    expect(piece.body.message).toBe("duplicate");
    await drainAnalytics(s.id);
    expect(await stored(s)).toHaveLength(1);
  });

  it("does not treat the same batch id on another site as a repeat", async () => {
    // Batch ids are random per page, but dedupe is keyed per site so one site cannot mask another's.
    const { site: a } = await site();
    const { site: b } = await site();
    const batchId = `b-${randomUUID()}`;
    await collect(a, { consent: true, batch_id: batchId, events: [pageview({ sid: sid() })] });
    const other = await collect(b, { consent: true, batch_id: batchId, events: [pageview({ sid: sid() })] });
    expect(other.body.message).toBe("processed");
  });

  it("ignores crawlers with 200 so they do not retry, and stores nothing", async () => {
    const { site: s } = await site();
    for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "curl/8.4.0", "python-requests/2.31", "Mozilla/5.0 (compatible; UptimeRobot/2.0)"]) {
      const res = await collect(s, { consent: true, events: [pageview({ sid: sid() })] }, { headers: { "User-Agent": ua } });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("ignored");
    }
    await drainAnalytics(s.id);
    expect(await stored(s)).toHaveLength(0);
  });

  it("ignores Meta's link checker, which calls itself mobile Chrome, by the network it comes from", async () => {
    const { site: s } = await site();
    const android = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";
    const fromMeta = await collect(s, { consent: true, events: [pageview({ sid: sid() })] }, { headers: { "User-Agent": android, "X-Forwarded-For": "2a03:2880:31ff:23::" } });
    expect(fromMeta.status).toBe(200);
    expect(fromMeta.body.message).toBe("ignored");
    await drainAnalytics(s.id);
    expect(await stored(s)).toHaveLength(0);
    // The same browser on a person's own connection is a visitor.
    const person = await collect(s, { consent: true, events: [pageview({ sid: sid() })] }, { headers: { "User-Agent": android, "X-Forwarded-For": "203.0.113.9" } });
    expect(person.body.message).toBe("processed");
  });

  it("refuses a batch from a page on another domain", async () => {
    const { site: s } = await site();
    const res = await collect(s, { consent: true, events: [pageview({ sid: sid() })] }, { headers: { Origin: "https://copycat.example" } });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("domain mismatch");
  });

  it("answers 404 for an unknown site and for one switched off", async () => {
    const { site: s } = await site();
    await sql`UPDATE websites SET is_active = false WHERE id = ${s.id}::uuid`;
    const off = await collect(s, { consent: true, events: [pageview({ sid: sid() })] });
    const unknown = await collect(s, { consent: true, events: [pageview({ sid: sid() })] }, { websiteRef: "trk_nobody" });
    expect(off.status).toBe(404);
    expect(unknown.status).toBe(404);
    await drainAnalytics(s.id);
    expect(await stored(s)).toHaveLength(0);
  });

  it("acknowledges an empty batch without looking the site up", async () => {
    // Unknown site, yet 200: an empty flush must not cost a lookup or produce an error.
    const res = await api("POST", "/api/v1/tracker/collect", { headers: { "User-Agent": BROWSER_UA }, body: { website_id: "trk_whatever", events: [] } });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("nothing to process");
  });

  it("rejects malformed JSON, a missing website id and wrongly typed fields with 400", async () => {
    const headers = { "User-Agent": BROWSER_UA };
    const badJson = await api("POST", "/api/v1/tracker/collect", { headers, body: "{not json" });
    const noSite = await api("POST", "/api/v1/tracker/collect", { headers, body: { events: [pageview({ sid: "x" })] } });
    const notArray = await api("POST", "/api/v1/tracker/collect", { headers, body: { website_id: "trk_x", events: "pageview" } });
    const tooMany = await api("POST", "/api/v1/tracker/collect", { headers, body: { website_id: "trk_x", errors: Array.from({ length: 21 }, () => ({ type: "error", ts: 1, url: "/", sid: "s", message: "x" })) } });
    expect(badJson.status).toBe(400);
    expect(badJson.body.error).toBe("invalid request body");
    expect(noSite.status).toBe(400);
    expect(notArray.status).toBe(400);
    expect(tooMany.status).toBe(400);
  });

  it("rejects a body over 8 MB before parsing it", async () => {
    const { site: s } = await site();
    const huge = JSON.stringify({ website_id: s.trackingId, events: [pageview({ sid: "s", data: { blob: "x".repeat(8 * 1024 * 1024 + 10) } })] });
    const res = await api("POST", "/api/v1/tracker/collect", { headers: siteHeaders(s), body: huge });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid request body");
  });

  it("stores a client timestamp from days ago at the time it arrived", async () => {
    // A wrong client clock (or seconds sent as ms) must not land events in 1970 or a past report.
    const { site: s } = await site();
    const before = Date.now();
    await collect(s, { consent: true, events: [pageview({ sid: sid(), ts: before - 10 * 86_400_000 }), pageview({ sid: sid(), ts: 1_000 })] });
    await drainAnalytics(s.id);
    const rows = await stored(s);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(new Date(r.occurred_at).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("keeps a recent client timestamp as sent", async () => {
    const { site: s } = await site();
    const ts = Date.now() - 3 * 3_600_000;
    await collect(s, { consent: true, events: [pageview({ sid: sid(), ts })] });
    await drainAnalytics(s.id);
    const [row] = await stored(s);
    expect(new Date(row!.occurred_at).getTime()).toBe(ts);
  });
});

describe("consent modes", () => {
  it("stores a US visitor on a cookieless site under the ids the browser sent", async () => {
    const { site: s } = await site();
    await collect(s, { events: [pageview({ sid: "sess-us", vid: "vis-us" })] });
    await drainAnalytics(s.id);
    const [row] = await stored(s);
    expect(row).toMatchObject({ visitor_id: "vis-us", session_id: "sess-us" });
  });

  it("replaces an EU visitor's ids with the day's anonymous id until they consent", async () => {
    const { site: s } = await site();
    const eu = { "CF-IPCountry": "FR" };
    await collect(s, { events: [pageview({ sid: "sess-eu", vid: "vis-eu", url: "/a" })] }, { headers: eu });
    // A second page from the same browser: same anonymous id (same day, IP and UA).
    await collect(s, { events: [pageview({ sid: "sess-eu-2", vid: "vis-eu-2", url: "/b" })] }, { headers: eu });
    await collect(s, { consent: true, events: [pageview({ sid: "sess-ok", vid: "vis-ok", url: "/c" })] }, { headers: eu });
    await drainAnalytics(s.id);

    const rows = await sql<{ page: string; visitor_id: string; session_id: string }[]>`
      SELECT page, visitor_id, session_id FROM analytics_events WHERE website_id = ${s.id} ORDER BY page`;
    const [a, b, c] = rows;
    expect(a!.visitor_id).toMatch(/^h-[0-9a-f]{32}$/);
    expect(a!.session_id).toBe(a!.visitor_id);
    expect(b!.visitor_id).toBe(a!.visitor_id);
    expect(c).toMatchObject({ visitor_id: "vis-ok", session_id: "sess-ok" });
  });

  it("anonymises a batch the tracker marks anonymous, wherever the visitor is", async () => {
    const { site: s } = await site();
    await collect(s, { anonymous: true, consent: true, events: [pageview({ sid: "sess-x", vid: "vis-x" })] });
    await drainAnalytics(s.id);
    const [row] = await stored(s);
    expect(row!.visitor_id).toMatch(/^h-/);
  });

  it("anonymises everyone on a strict site, and stores nothing without consent", async () => {
    const { site: s } = await site({ consentMode: "strict" });
    const refused = await collect(s, { events: [pageview({ sid: "s1", vid: "v1" })] });
    const granted = await collect(s, { consent: true, events: [pageview({ sid: "s2", vid: "v2" })] });
    expect(refused.body.message).toBe("tracking disabled by privacy policy");
    expect(granted.body.message).toBe("processed");
    await drainAnalytics(s.id);
    const rows = await stored(s);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ visitor_id: "v2", session_id: "s2" });
  });

  it("keeps real ids for an EU visitor when the site asks no consent ('none')", async () => {
    const { site: s } = await site({ consentMode: "none" });
    await collect(s, { events: [pageview({ sid: "s-none", vid: "v-none" })] }, { headers: { "CF-IPCountry": "DE" } });
    await drainAnalytics(s.id);
    const [row] = await stored(s);
    expect(row).toMatchObject({ visitor_id: "v-none", session_id: "s-none" });
  });

  it("drops a Do-Not-Track visitor when the site respects DNT", async () => {
    const { site: s } = await site({ respectDnt: true });
    const res = await collect(s, { consent: true, events: [pageview({ sid: sid() })] }, { headers: { DNT: "1" } });
    expect(res.body.message).toBe("tracking disabled by privacy policy");
    await drainAnalytics(s.id);
    expect(await stored(s)).toHaveLength(0);
  });
});
