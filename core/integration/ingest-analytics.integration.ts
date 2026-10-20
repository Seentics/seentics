/**
 * Tracker → queue → analytics_events → dashboard, on the raw-event path (rollups are only
 * switched on at startup, which the harness does not run — ingest-rollups covers them).
 */
import { describe, expect, it } from "bun:test";
import { addMember, api, seedUser, seedWebsite, sql, type SeededUser, type SeededWebsite } from "./harness";
import { collect, drainAnalytics, insertEvents, pageview, sid } from "./helpers/ingest";
import { rollupsEnabled } from "../modules/analytics/rollups/reads";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const get = (path: string, s: SeededWebsite, user: SeededUser, query: Record<string, string | number> = {}) =>
  api("GET", `/api/v1/analytics/${path}/${s.id}`, { token: user.token, query });

/**
 * One small, fully known day of traffic sent through /collect:
 * - vis-a, session A: / then /pricing 60 s later, from google, UTM newsletter/email, in the US, desktop
 * - vis-a, session B: / alone (a bounce), direct, in the US, desktop
 * - vis-b, session C: /pricing alone (a bounce), from twitter, in Germany (consented), iPhone, signs up and buys
 */
async function seedTraffic() {
  const owner = await seedUser();
  const s = await seedWebsite(owner.id);
  const t0 = Date.now() - 30 * 60_000;
  const [a, b, c] = [sid(), sid(), sid()];
  const url = (p: string) => `https://${s.domain}${p}`;

  await collect(s, {
    events: [
      pageview({ sid: a, vid: "vis-a", url: url("/"), ts: t0, data: { referrer: "https://www.google.com/search?q=x", utm_source: "newsletter", utm_medium: "email", utm_campaign: "fall" } }),
      pageview({ sid: a, vid: "vis-a", url: url("/pricing"), ts: t0 + 60_000, data: { referrer: url("/") } }),
      pageview({ sid: b, vid: "vis-a", url: url("/"), ts: t0 + 120_000 }),
    ],
  });
  await collect(s, {
    consent: true,
    events: [
      pageview({ sid: c, vid: "vis-b", url: url("/pricing"), ts: t0 + 180_000, data: { referrer: "https://t.co/abc" } }),
      { type: "custom", sid: c, vid: "vis-b", url: url("/pricing"), ts: t0 + 190_000, data: { name: "signup" } },
      { type: "custom", sid: c, vid: "vis-b", url: url("/pricing"), ts: t0 + 200_000, data: { name: "purchase", value: 49.5, currency: "usd" } },
    ],
  }, { headers: { "CF-IPCountry": "DE", "User-Agent": IPHONE_UA } });
  await drainAnalytics(s.id);
  return { owner, site: s };
}

describe("the dashboard over traffic sent through /collect", () => {
  it("reads raw events in this file (no rollups)", () => {
    expect(rollupsEnabled()).toBe(false);
  });

  it("counts pageviews, visitors, sessions, bounce rate and duration", async () => {
    const { owner, site } = await seedTraffic();

    const res = await get("dashboard", site, owner, { days: 7 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page_views: 4, unique_visitors: 2, sessions: 3, live_visitors: 0 });
    // Two of three sessions saw one page; A lasted 60 s, the bounces 0 s (and C's custom
    // events stretch it to 20 s: duration runs to the last event of any kind).
    expect(res.body.bounce_rate).toBeCloseTo(66.67, 1);
    expect(res.body.session_duration).toBe(Math.round((60 + 0 + 20) / 3));
    expect(res.body.metrics.pages_per_session).toBeCloseTo(1.33, 2);
  });

  it("ranks pages by path, ignoring the query string", async () => {
    const { owner, site } = await seedTraffic();
    const res = await get("top-pages", site, owner);
    expect(res.body.top_pages).toEqual([
      { page: "/", views: 2, unique: 1 },
      { page: "/pricing", views: 2, unique: 2 },
    ]);
  });

  it("credits each session's pageviews to the domain it arrived from", async () => {
    const { owner, site } = await seedTraffic();
    const res = await get("top-referrers", site, owner);
    const byRef = Object.fromEntries(res.body.top_referrers.map((r: { referrer: string; views: number }) => [r.referrer, r.views]));
    // Session A's second pageview (an in-site click) stays with google.com.
    expect(byRef).toEqual({ "google.com": 2, "t.co": 1, direct: 1 });
  });

  it("breaks traffic down by country and device", async () => {
    const { owner, site } = await seedTraffic();
    const countries = await get("top-countries", site, owner);
    const devices = await get("top-devices", site, owner);
    expect(countries.body.top_countries).toEqual([
      { country: "US", views: 3, unique: 1 },
      { country: "DE", views: 1, unique: 1 },
    ]);
    const byDevice = Object.fromEntries(devices.body.top_devices.map((d: { device: string; views: number }) => [d.device, d.views]));
    expect(byDevice.Desktop).toBe(3);
    expect(Object.keys(byDevice)).toHaveLength(2);
  });

  it("attributes sessions to their landing UTM source", async () => {
    const { owner, site } = await seedTraffic();
    const sources = await get("top-sources", site, owner);
    const utm = await get("page-utm-breakdown", site, owner);
    expect(sources.body.top_sources.map((r: { source: string }) => r.source)).toEqual(["newsletter"]);
    expect(utm.body.breakdown.length).toBeGreaterThan(0);
    expect(JSON.stringify(utm.body.breakdown)).toContain("newsletter");
  });

  it("counts a goal's completions and its conversion rate over visitors", async () => {
    const { owner, site } = await seedTraffic();
    await sql`INSERT INTO goals (website_id, name, type, identifier) VALUES (${site.id}::uuid, 'Signed up', 'event', 'signup')`;
    const res = await get("goals-stats", site, owner);
    expect(res.body.goals).toHaveLength(1);
    expect(res.body.goals[0]).toMatchObject({ name: "Signed up", completions: 1, unique_visitors: 1, conversion_rate: 50 });
  });

  it("draws the day's views on the daily and hourly charts", async () => {
    const { owner, site } = await seedTraffic();
    const daily = await get("daily-stats", site, owner, { days: 7 });
    const hourly = await get("hourly-stats", site, owner, { days: 1 });
    const totalDaily = daily.body.daily_stats.reduce((n: number, d: { views: number }) => n + d.views, 0);
    const totalHourly = hourly.body.hourly_stats.reduce((n: number, d: { views: number }) => n + d.views, 0);
    expect(totalDaily).toBe(4);
    expect(totalHourly).toBe(4);
    for (const h of hourly.body.hourly_stats) expect(h.hour_label).toBe(`${String(h.hour).padStart(2, "0")}:00`);
  });

  it("reports revenue from purchase events", async () => {
    const { owner, site } = await seedTraffic();
    const res = await get("revenue", site, owner);
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ total_revenue: 49.5, currency: "USD", orders: 1 });
    expect(res.body.other_currencies).toBeUndefined();
  });

  it("exports every stored event of the site", async () => {
    const { owner, site } = await seedTraffic();
    const res = await get("export", site, owner);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(6);
    expect(res.body.truncated).toBe(false);
    expect(new Set(res.body.data.map((e: { event_type: string }) => e.event_type))).toEqual(new Set(["pageview", "signup", "purchase"]));
  });
});

describe("revenue in more than one currency", () => {
  it("totals the currency most orders used and lists the others apart, never summed", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const at = new Date(Date.now() - 3_600_000);
    await insertEvents(site.id, [
      { type: "purchase", session: sid(), at, properties: { value: 10, currency: "USD" } },
      { type: "purchase", session: sid(), at, properties: { value: 20, currency: "usd" } },
      { type: "purchase", session: sid(), at, properties: { value: 1000, currency: "JPY" } },
    ]);

    const res = await get("revenue", site, owner);

    expect(res.body.summary.currency).toBe("USD");
    expect(res.body.summary.total_revenue).toBe(30);
    expect(res.body.summary.orders).toBe(2);
    expect(res.body.other_currencies).toEqual([{ currency: "JPY", orders: 1, revenue: 1000 }]);
    expect(res.body.data_note).toContain("not converted");
  });
});

describe("empty and edge ranges", () => {
  it("answers zeros, not NaN, for a site with no traffic", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const res = await get("dashboard", site, owner);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page_views: 0, unique_visitors: 0, sessions: 0, bounce_rate: 0, session_duration: 0 });
    expect(res.body.metrics.pages_per_session).toBe(0);
    const c = res.body.comparison;
    for (const k of ["visitor_change", "pageview_change", "session_change", "bounce_change", "duration_change"]) {
      expect(Number.isFinite(c[k])).toBe(true);
    }
    const goals = await get("goals-stats", site, owner);
    expect(goals.status).toBe(200);
    const revenue = await get("revenue", site, owner);
    expect(revenue.body.data_quality).toBe("no_revenue");
  });

  it("falls back to the default range for a zero, negative, non-numeric or over-a-year `days`", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    for (const days of ["0", "-3", "abc", "400"]) {
      const res = await get("dashboard", site, owner, { days });
      expect(res.status).toBe(200);
      expect(res.body.date_range).toBe("7d");
    }
    const ok = await get("dashboard", site, owner, { days: 365 });
    expect(ok.body.date_range).toBe("365d");
  });

  it("leaves out events just before the window and keeps those just inside it", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const now = Date.now();
    await insertEvents(site.id, [
      { session: sid(), at: new Date(now - 86_400_000 + 60_000) }, // inside the last 24 h
      { session: sid(), at: new Date(now - 86_400_000 - 60_000) }, // a minute too old
    ]);
    const res = await get("dashboard", site, owner, { days: 1 });
    expect(res.body.page_views).toBe(1);
    expect(res.body.comparison.previous_period.page_views).toBe(1);
  });

  it("compares equal traffic in the two periods as no change", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const now = Date.now();
    await insertEvents(site.id, [
      { session: sid(), at: new Date(now - 3_600_000) },
      { session: sid(), at: new Date(now - 86_400_000 - 3_600_000) },
    ]);
    const res = await get("dashboard", site, owner, { days: 1 });
    expect(res.body.comparison.pageview_change).toBe(0);
    expect(res.body.comparison.visitor_change).toBe(0);
    expect(res.body.comparison.session_change).toBe(0);
  });

  it("reports a doubling as +100% and a drop to nothing as −100%", async () => {
    const owner = await seedUser();
    const up = await seedWebsite(owner.id);
    const down = await seedWebsite(owner.id);
    const now = Date.now();
    await insertEvents(up.id, [
      { session: sid(), at: new Date(now - 3_600_000) },
      { session: sid(), at: new Date(now - 7_200_000) },
      { session: sid(), at: new Date(now - 86_400_000 - 3_600_000) },
    ]);
    await insertEvents(down.id, [{ session: sid(), at: new Date(now - 86_400_000 - 3_600_000) }]);
    expect((await get("dashboard", up, owner, { days: 1 })).body.comparison.pageview_change).toBe(100);
    expect((await get("dashboard", down, owner, { days: 1 })).body.comparison.pageview_change).toBe(-100);
  });
});

describe("time zones", () => {
  const localDay = (at: Date, tz: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  const localHour = (at: Date, tz: string) =>
    Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(at));

  it("puts a day's views on the viewer's local date and hour", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const at = new Date(Date.now() - 2 * 3_600_000);
    await insertEvents(site.id, [{ session: sid(), at }]);

    for (const tz of ["UTC", "Asia/Tokyo", "America/Los_Angeles", "Asia/Kolkata"]) {
      const daily = await get("daily-stats", site, owner, { days: 3, timezone: tz });
      const hourly = await get("hourly-stats", site, owner, { days: 1, timezone: tz });
      // Every day of the window is listed (zero-filled); only the event's has views.
      expect(daily.body.daily_stats.filter((d: { views: number }) => d.views)).toEqual([{ date: localDay(at, tz), views: 1, unique: 1 }]);
      // Kolkata is UTC+5:30, so its hour differs from UTC's by a half-hour shift in the bucket.
      expect(hourly.body.hourly_stats.map((h: { hour: number }) => h.hour)).toEqual([localHour(at, tz)]);
    }
  });

  it("reads a bare offset like '+05' as UTC rather than shifting the day the wrong way", async () => {
    // Postgres reads "+05" in POSIX terms (west-positive); passing it through moved days by 10 h.
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    const at = new Date(Date.now() - 2 * 3_600_000);
    await insertEvents(site.id, [{ session: sid(), at }]);
    for (const tz of ["+05", "-03", "Not/AZone", "UTC'; DROP TABLE x;--"]) {
      const res = await get("hourly-stats", site, owner, { days: 1, timezone: tz });
      expect(res.status).toBe(200);
      expect(res.body.hourly_stats.map((h: { hour: number }) => h.hour)).toEqual([at.getUTCHours()]);
    }
  });
});

describe("who may read a site's analytics", () => {
  const routes = [
    "dashboard", "traffic-summary", "daily-stats", "hourly-stats", "top-pages", "top-referrers", "top-sources",
    "top-browsers", "top-devices", "top-os", "top-countries", "top-cities", "top-languages", "top-resolutions",
    "geolocation-breakdown", "page-utm-breakdown", "dimensions-bulk", "activity-trends", "path-analysis",
    "visitor-insights", "custom-events", "goals-stats", "revenue", "export", "live-visitors",
  ];

  it("asks for a sign-in on every route", async () => {
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    for (const r of routes) {
      const res = await api("GET", `/api/v1/analytics/${r}/${site.id}`);
      expect([r, res.status]).toEqual([r, 401]);
    }
  });

  it("refuses another account on every route", async () => {
    const owner = await seedUser();
    const stranger = await seedUser();
    const site = await seedWebsite(owner.id);
    await insertEvents(site.id, [{ session: sid(), at: new Date() }]);
    for (const r of routes) {
      const res = await get(r, site, stranger);
      expect([r, res.status]).toEqual([r, 403]);
    }
  });

  it("lets a viewer of the site read it, and not a site they are not on", async () => {
    const ownerA = await seedUser();
    const ownerB = await seedUser();
    const viewer = await seedUser();
    const a = await seedWebsite(ownerA.id);
    const b = await seedWebsite(ownerB.id);
    await addMember(b.id, viewer.id, "viewer");
    await insertEvents(a.id, [{ session: sid(), at: new Date() }]);

    const own = await get("dashboard", b, viewer);
    const other = await get("dashboard", a, viewer);
    const otherExport = await get("export", a, viewer);

    expect(own.status).toBe(200);
    expect(other.status).toBe(403);
    expect(otherExport.status).toBe(403);
  });

  it("refuses a site id that does not exist the same way as one that is not yours", async () => {
    const user = await seedUser();
    const res = await api("GET", `/api/v1/analytics/dashboard/00000000-0000-4000-8000-000000000000`, { token: user.token });
    expect(res.status).toBe(403);
  });

  it("answers 404 for a website reference that is not a UUID (a tracking id, garbage)", async () => {
    // The dashboard addresses sites by UUID; anything else must not reach a query as data.
    const owner = await seedUser();
    const site = await seedWebsite(owner.id);
    for (const ref of [site.trackingId, "not-a-uuid"]) {
      const res = await api("GET", `/api/v1/analytics/dashboard/${ref}`, { token: owner.token });
      expect(res.status).toBe(404);
    }
  });
});
