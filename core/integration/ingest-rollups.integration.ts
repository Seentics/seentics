/**
 * The dashboard rollups (hll present in the test Postgres): the builder, its stale markers
 * and pacing, and the reads — which must say what the raw-event path says.
 *
 * The builder only ever runs for this file's own sites (`buildStaleRollups({ websiteId })`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { api, seedUser, seedWebsite, sql, type SeededUser, type SeededWebsite } from "./harness";
import { collect, drainAnalytics, insertEvents, markStale, pageview, sid, todayUtc, utcDay } from "./helpers/ingest";
import { buildStaleRollups, rebuildWebsiteDay, resetRebuildPacingForTests } from "../modules/analytics/rollups/builder";
import { rawEventsFrom } from "../modules/analytics/lib/raw-window";
import { detectRollups, rollupsEnabled, setRollupRefresher, setRollupsEnabled } from "../modules/analytics/rollups/reads";

const DAY = 86_400_000;
const realRefresh = (websiteId: string) => buildStaleRollups({ websiteId, recentOnly: true });

beforeAll(async () => {
  expect(await detectRollups()).toBe(true);
});
afterAll(() => {
  setRollupsEnabled(false);
  setRollupRefresher(realRefresh);
});
beforeEach(() => {
  setRollupsEnabled(true);
  // Builder tests drive every rebuild themselves; a read's own refresh would race them.
  setRollupRefresher(async () => undefined);
  resetRebuildPacingForTests();
});

const get = (path: string, s: SeededWebsite, user: SeededUser, query: Record<string, string | number> = {}) =>
  api("GET", `/api/v1/analytics/${path}/${s.id}`, { token: user.token, query });

/**
 * Rebuild the given UTC days directly. `buildStaleRollups` cannot run on this Postgres (no
 * TimescaleDB — see the BUG test below), so the reads are checked against days built this way.
 */
async function rebuild(websiteId: string, days: string[]) {
  for (const day of new Set(days)) await rebuildWebsiteDay(websiteId, day);
}

async function staleDays(websiteId: string): Promise<string[]> {
  const rows = await sql<{ day: string }[]>`SELECT day::text AS day FROM analytics_rollup_stale WHERE website_id = ${websiteId} ORDER BY day`;
  return rows.map((r) => r.day);
}

/** A mixed few hours of traffic, written straight to analytics_events and marked stale. */
async function seedMixedTraffic(websiteId: string) {
  const now = Date.now();
  const t = (minsAgo: number) => new Date(now - minsAgo * 60_000);
  const [a, b, c, d] = [sid(), sid(), sid(), sid()];
  await insertEvents(websiteId, [
    { session: a, visitor: "va", page: "https://x.test/", at: t(170), referrer: "https://www.google.com/", country: "US", device: "Desktop", browser: "Chrome 126", utm: { source: "news", medium: "email", campaign: "fall" } },
    { session: a, visitor: "va", page: "https://x.test/pricing", at: t(168), referrer: "https://x.test/", country: "US", device: "Desktop", browser: "Chrome 126" },
    { session: a, visitor: "va", page: "https://x.test/signup", at: t(165), country: "US", device: "Desktop", browser: "Chrome 126" },
    { type: "signup", session: a, visitor: "va", at: t(164) },
    { session: b, visitor: "vb", page: "https://x.test/pricing?ref=1", at: t(120), referrer: "https://t.co/z", country: "DE", device: "Mobile", browser: "Safari 17" },
    { type: "purchase", session: b, visitor: "vb", at: t(119), properties: { value: 30, currency: "EUR" } },
    { session: c, visitor: "va", page: "https://x.test/", at: t(60), country: "US", device: "Desktop", browser: "Chrome 126" },
    { type: "purchase", session: c, visitor: "va", at: t(59), properties: { value: 12.5, currency: "EUR" } },
    { session: d, visitor: "vd", page: "https://x.test/blog", at: t(30), country: "GB", device: "Tablet", browser: "Firefox 130" },
    { session: d, visitor: "vd", page: "https://x.test/", at: t(25), country: "GB", device: "Tablet", browser: "Firefox 130" },
    { type: "purchase", session: d, visitor: "vd", at: t(24), properties: { value: 5, currency: "USD" } },
  ]);
  await markStale(websiteId, [utcDay(t(170)), utcDay(t(0))]);
  return [utcDay(t(170)), utcDay(t(0))];
}

describe("rebuilding from stale markers", () => {
  // The CASE guard does not help: Postgres resolves every relation in the statement before it
  // runs, so the subquery on timescaledb_information.jobs fails whenever TimescaleDB is absent
  // — and with it every buildStaleRollups (the scheduled builder and the dashboard's own
  // refresh). On an hll-without-TimescaleDB Postgres the rollups are never built after startup.
  // The suite runs on both databases: plain Postgres with hll (self-hosted) and the
  // production image with TimescaleDB. Without it the lookup threw and stopped every build.
  it("rawEventsFrom() answers null without TimescaleDB, and the retention edge with it", async () => {
    const [ts] = await sql<{ ok: boolean }[]>`SELECT to_regclass('timescaledb_information.jobs') IS NOT NULL AS ok`;
    const from = await rawEventsFrom();
    if (!ts!.ok) expect(from).toBeNull();
    else {
      // The day after the retention policy's edge (about a month back, db/sql/037–038).
      const daysBack = (Date.now() - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
      expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(daysBack).toBeGreaterThan(27);
      expect(daysBack).toBeLessThan(32);
    }
  });

  it("clears the site's stale markers after rebuilding them, and leaves other sites' alone", async () => {
    const owner = await seedUser();
    const a = await seedWebsite(owner.id);
    const b = await seedWebsite(owner.id);
    await insertEvents(a.id, [{ session: sid(), at: new Date() }]);
    await insertEvents(b.id, [{ session: sid(), at: new Date() }]);
    const today = utcDay(new Date());
    await markStale(a.id, [today]);
    await markStale(b.id, [today]);

    const result = await buildStaleRollups({ websiteId: a.id });

    expect(result.rebuilt).toBeGreaterThanOrEqual(1);
    expect(await staleDays(a.id)).toEqual([]);
    expect(await staleDays(b.id)).toEqual([today]);
    const [row] = await sql<{ pageviews: number }[]>`
      SELECT pageviews::int FROM analytics_rollup_daily WHERE website_id = ${a.id} AND day = ${today}::date AND dimension = 'site'`;
    expect(row?.pageviews).toBe(1);
  });

  it("marks the day stale when /collect writes into it", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    await collect(s, { consent: true, events: [pageview({ sid: sid() })] });
    await drainAnalytics(s.id);
    expect(await staleDays(s.id)).toEqual([utcDay(new Date())]);
  });

  it("keeps a stale marker for the previous day when pacing defers its rebuild", async () => {
    // A stale day also rebuilds the day before (sessions crossing midnight). When pacing put
    // that off, nothing remembered it and yesterday's session rows stayed wrong.
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    const today = utcDay(new Date());
    const tomorrow = utcDay(new Date(todayUtc() + DAY));
    await insertEvents(s.id, [{ session: sid(), at: new Date() }]);
    await markStale(s.id, [today]);
    await buildStaleRollups({ websiteId: s.id }); // today was just rebuilt: paced for the next 5 s
    expect(await staleDays(s.id)).toEqual([]);

    // A marker on the next day (a clock a little ahead) pulls in today as its previous day.
    await markStale(s.id, [tomorrow]);
    await buildStaleRollups({ websiteId: s.id });

    expect(await staleDays(s.id)).toEqual([today]);

    // Once pacing allows, the remembered day is rebuilt and its marker goes.
    resetRebuildPacingForTests();
    await buildStaleRollups({ websiteId: s.id });
    expect(await staleDays(s.id)).toEqual([]);
  });

  it("keeps a paced day's own marker until it is rebuilt", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    const today = utcDay(new Date());
    await insertEvents(s.id, [{ session: sid(), at: new Date() }]);
    await markStale(s.id, [today]);
    await buildStaleRollups({ websiteId: s.id });
    await insertEvents(s.id, [{ session: sid(), at: new Date() }]);
    await markStale(s.id, [today]);

    await buildStaleRollups({ websiteId: s.id });

    expect(await staleDays(s.id)).toEqual([today]);
  });

  it("leaves an older day for the scheduled run when asked for recent days only", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    const old = utcDay(new Date(todayUtc() - 3 * DAY));
    await markStale(s.id, [old]);
    const recent = await buildStaleRollups({ websiteId: s.id, recentOnly: true });
    expect(recent.rebuilt).toBe(0);
    expect(await staleDays(s.id)).toEqual([old]);
    await buildStaleRollups({ websiteId: s.id });
    expect(await staleDays(s.id)).toEqual([]);
  });

  it("rebuilds a day to the same rows however many times it runs", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    await seedMixedTraffic(s.id);
    const today = utcDay(new Date());
    const snapshot = () => sql`
      SELECT dimension, value, pageviews, sessions, bounces, duration_s FROM analytics_rollup_daily
      WHERE website_id = ${s.id} AND day = ${today}::date ORDER BY dimension, value`;
    await rebuildWebsiteDay(s.id, today);
    const first = await snapshot();
    await rebuildWebsiteDay(s.id, today);
    expect(await snapshot()).toEqual(first);
    expect(first.length).toBeGreaterThan(5);
  });

  // A value over Postgres's ~2.7 KB index-entry limit failed the whole site-day's rebuild, on
  // every run: one tracker request with a long random utm_source froze that day's dashboard.
  it("rebuilds a day whose events carry values too long for the rollup key", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    const random = (n: number) => Array.from({ length: n }, () => Math.random().toString(36).slice(2)).join("").slice(0, n);
    // As long as ingest lets them through: UTM tags at 256 characters, a non-Latin path at
    // ~2 KB. Fine for the raw table's indexes; together, as page_utm, past the key's limit.
    const long = random(256);
    const cjkPath = `https://x.test/${"\u6f22".repeat(670)}`;
    const a = sid();
    await insertEvents(s.id, [
      { session: a, visitor: "va", page: cjkPath, at: new Date(Date.now() - 60_000), utm: { source: long, medium: long, campaign: long } },
      { session: a, visitor: "va", page: "https://x.test/ok", at: new Date(Date.now() - 30_000) },
      { type: "custom", session: a, visitor: "va", at: new Date(Date.now() - 20_000), properties: { name: random(5000) } },
    ]);
    const today = utcDay(new Date());
    await rebuildWebsiteDay(s.id, today);
    const rows = await sql<{ dimension: string; n: number }[]>`
      SELECT dimension, max(length(value))::int AS n FROM analytics_rollup_daily
      WHERE website_id = ${s.id} AND day = ${today}::date GROUP BY dimension`;
    const byDim = Object.fromEntries(rows.map((r) => [r.dimension, r.n]));
    expect(byDim.site).toBeDefined();
    expect(byDim.utm_source).toBe(256);
    expect(byDim.page).toBeLessThanOrEqual(500);
    expect(byDim.page_utm).toBe(500);
    expect(byDim.custom_name).toBe(500);
  });
});

describe("rollup reads match the raw-event reads", () => {
  /** The same request on the rollups and on raw events. */
  async function both(path: string, s: SeededWebsite, owner: SeededUser, query: Record<string, string | number> = {}) {
    setRollupsEnabled(true);
    const rolled = await get(path, s, owner, query);
    setRollupsEnabled(false);
    const raw = await get(path, s, owner, query);
    setRollupsEnabled(true);
    expect(rolled.status).toBe(200);
    expect(raw.status).toBe(200);
    return { rolled: rolled.body, raw: raw.body };
  }

  it("gives the same headline numbers", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    await rebuild(s.id, await seedMixedTraffic(s.id));

    const { rolled, raw } = await both("dashboard", s, owner, { days: 7, live: "0" });

    expect(rolled.page_views).toBe(7);
    for (const k of ["page_views", "unique_visitors", "sessions", "bounce_rate", "session_duration"]) {
      expect([k, rolled[k]]).toEqual([k, raw[k]]);
    }
    expect(rolled.metrics.pages_per_session).toBe(raw.metrics.pages_per_session);
  });

  it("gives the same top pages, referrers, countries and devices", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    await rebuild(s.id, await seedMixedTraffic(s.id));

    for (const [path, key] of [["top-pages", "top_pages"], ["top-referrers", "top_referrers"], ["top-countries", "top_countries"], ["top-devices", "top_devices"], ["top-browsers", "top_browsers"]] as const) {
      const { rolled, raw } = await both(path, s, owner);
      const sort = (rows: { views: number }[]) => [...rows].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
      expect([path, sort(rolled[key])]).toEqual([path, sort(raw[key])]);
    }
  });

  it("gives the same daily chart, goals and UTM sources", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    await rebuild(s.id, await seedMixedTraffic(s.id));
    await sql`INSERT INTO goals (website_id, name, type, identifier) VALUES (${s.id}::uuid, 'Signup', 'event', 'signup')`;

    const daily = await both("daily-stats", s, owner, { days: 7 });
    expect(daily.rolled.daily_stats).toEqual(daily.raw.daily_stats);
    const goals = await both("goals-stats", s, owner);
    expect(goals.rolled.goals[0].completions).toBe(1);
    expect(goals.rolled.goals[0].completions).toBe(goals.raw.goals[0].completions);
    expect(goals.rolled.goals[0].conversion_rate).toBe(goals.raw.goals[0].conversion_rate);
    const sources = await both("top-sources", s, owner);
    expect(sources.rolled.top_sources.map((r: { source: string }) => r.source)).toEqual(["news"]);
  });

  it("gives the same revenue, in the majority currency, with the others kept apart", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    await rebuild(s.id, await seedMixedTraffic(s.id));

    const { rolled, raw } = await both("revenue", s, owner, { days: 7 });

    expect(rolled.summary).toMatchObject({ currency: "EUR", total_revenue: 42.5, orders: 2 });
    expect(rolled.other_currencies).toEqual([{ currency: "USD", orders: 1, revenue: 5 }]);
    expect(raw.summary.total_revenue).toBe(rolled.summary.total_revenue);
    expect(raw.other_currencies).toEqual(rolled.other_currencies);
  });
});

describe("the previous period on the rollups", () => {
  it("compares today so far with yesterday up to the same time, so a flat day reads as no change", async () => {
    // It used to set all of yesterday against today so far: at 09:00 a flat day read as a big drop.
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    const midnight = todayUtc();
    const elapsed = Date.now() - midnight;
    const sameTimeToday = new Date(midnight + Math.floor(elapsed / 2));
    const sameTimeYesterday = new Date(sameTimeToday.getTime() - DAY);
    const events = [
      { session: sid(), at: sameTimeToday },
      { session: sid(), at: sameTimeYesterday },
    ];
    // Traffic late yesterday, past the point today has reached — out of the comparison.
    const lateYesterday = new Date(midnight - 30 * 60_000);
    const canSeedLate = lateYesterday.getTime() - (midnight - DAY) > elapsed + 3_600_000;
    if (canSeedLate) events.push({ session: sid(), at: lateYesterday }, { session: sid(), at: lateYesterday });
    await insertEvents(s.id, events);
    await rebuild(s.id, [utcDay(sameTimeToday), utcDay(sameTimeYesterday), ...(canSeedLate ? [utcDay(lateYesterday)] : [])]);

    const res = await get("dashboard", s, owner, { days: 1, live: "0" });

    expect(res.body.page_views).toBe(1);
    expect(res.body.comparison.previous_period.page_views).toBe(1);
    expect(res.body.comparison.pageview_change).toBe(0);
    expect(res.body.comparison.session_change).toBe(0);
  });

  it("reports growth when today has more than yesterday at the same point", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    const midnight = todayUtc();
    const at = new Date(midnight + Math.floor((Date.now() - midnight) / 2));
    const prev = new Date(at.getTime() - DAY);
    await insertEvents(s.id, [{ session: sid(), at }, { session: sid(), at }, { session: sid(), at: prev }]);
    await rebuild(s.id, [utcDay(at), utcDay(prev)]);

    const res = await get("dashboard", s, owner, { days: 1, live: "0" });

    expect(res.body.comparison.pageview_change).toBe(100);
  });
});

describe("time zones on the rollups", () => {
  const localDay = (at: Date, tz: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

  it("draws the daily chart in the viewer's local days", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    const at = new Date(Date.now() - 2 * 3_600_000);
    await insertEvents(s.id, [{ session: sid(), at }]);
    await rebuild(s.id, [utcDay(at)]);

    for (const tz of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
      const res = await get("daily-stats", s, owner, { days: 3, timezone: tz });
      expect([tz, res.body.daily_stats]).toEqual([tz, [{ date: localDay(at, tz), views: 1, unique: 1 }]]);
    }
  });

  it("reads a bare offset as UTC", async () => {
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    const at = new Date(Date.now() - 2 * 3_600_000);
    await insertEvents(s.id, [{ session: sid(), at }]);
    await rebuild(s.id, [utcDay(at)]);
    const res = await get("hourly-stats", s, owner, { days: 1, timezone: "+05" });
    expect(res.body.hourly_stats.map((h: { hour: number }) => h.hour)).toEqual([at.getUTCHours()]);
  });
});

describe("freshness on read", () => {
  it("shows events that just arrived through /collect without waiting for the scheduled builder", async () => {
    setRollupRefresher(realRefresh);
    const owner = await seedUser();
    const s = await seedWebsite(owner.id);
    await collect(s, { consent: true, events: [pageview({ sid: sid(), url: `https://${s.domain}/` }), pageview({ sid: sid(), url: `https://${s.domain}/b` })] });
    await drainAnalytics(s.id);
    expect(rollupsEnabled()).toBe(true);

    const res = await get("dashboard", s, owner, { days: 1, live: "0" });

    expect(res.body.page_views).toBe(2);
    expect(await staleDays(s.id)).toEqual([]);
  });
});

describe("the websites list on the rollups", () => {
  it("reports each site's 30-day traffic from the rollups, matching the raw events", async () => {
    const owner = await seedUser();
    const busy = await seedWebsite(owner.id);
    const quiet = await seedWebsite(owner.id);
    await rebuild(busy.id, await seedMixedTraffic(busy.id));

    const stats = async () => {
      const res = await api("GET", "/api/v1/websites", { token: owner.token });
      expect(res.status).toBe(200);
      return Object.fromEntries(res.body.data.map((s: { id: string; stats: unknown }) => [s.id, s.stats]));
    };
    const fromRollups = await stats();
    setRollupsEnabled(false);
    const fromRaw = await stats();

    expect(fromRollups[busy.id]).toEqual(expect.objectContaining({ totalPageviews: 7, uniqueVisitors: 3 }));
    expect(fromRollups[quiet.id]).toEqual(expect.objectContaining({ totalPageviews: 0, uniqueVisitors: 0 }));
    expect(fromRollups).toEqual(fromRaw);
  });
});
