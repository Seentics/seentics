/**
 * Dashboard API audit: correctness against an independent SQL reference, cross-endpoint
 * consistency, and cold/warm latency — for every seeded site (`seed/seed.ts`) and range.
 *
 *   bun analytics/audit.ts                       all sites, 7/30/90 days
 *   bun analytics/audit.ts --sites small --days 30
 *
 * The reference queries are deliberately naive — one obvious SELECT per metric, written
 * from the metric's name and the repository's own comments, not copied from it — so a
 * disagreement means one of the two is wrong and is worth a look, not that the audit
 * re-derived the bug. Writes results/audit-<time>.json and prints a summary.
 */
import { SQL } from "bun";
import { session } from "../lib/api";
import { checker, close, printFailures, saveResults, U, type Check } from "../lib/checks";
import { DATABASE_URL, readState } from "../lib/config";

const state = await readState();
const db = new SQL(DATABASE_URL);
const { get } = session(state);

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const siteNames = (arg("sites") ?? "small,medium,large").split(",");
const ranges = (arg("days") ?? "7,30,90").split(",").map(Number);

const ENDPOINTS = [
  "dashboard", "traffic-summary", "daily-stats", "hourly-stats", "top-pages", "top-referrers", "top-sources",
  "top-browsers", "top-devices", "top-os", "top-countries", "top-cities", "top-languages", "top-resolutions",
  "geolocation-breakdown", "page-utm-breakdown", "dimensions-bulk", "activity-trends", "path-analysis",
  "visitor-insights", "custom-events", "goals-stats", "revenue", "realtime", "live-visitors", "recent-activity", "realtime-geo",
];

/** One endpoint, timed; the warm call repeats the previous cold URL exactly. */
const call = (ep: string, siteId: string, days: number, cold: boolean) =>
  get(`/api/v1/analytics/${ep}/${siteId}?days=${days}&timezone=UTC`, cold);

// ─── Reference queries ───────────────────────────────────────────────────────

const VKEY = db`coalesce(nullif(trim(visitor_id), ''), session_id)`;
// The dashboard's grouping rules, written independently of lib/dimension-sql.ts.
const PATH = db`coalesce(nullif(split_part(split_part(regexp_replace(page, '^https?://[^/?#]*', '', 'i'), '?', 1), '#', 1), ''), '/')`;
// Backslashes doubled: in a tagged template the SQL gets the cooked string, where `\s`
// is just `s` — the first version of this reference silently never stripped a version.
const NAME = (col: string) => db`nullif(trim(regexp_replace(${db(col)}, '\\s+v?[0-9][0-9._]*$', '')), '')`;
const DOMAIN = db`nullif(lower(regexp_replace(substring(referrer from '^[a-z][a-z0-9+.-]*://([^/?#:]+)'), '^www\\.', '', 'i')), '')`;

/** Calendar days in UTC, as the endpoints read them: today plus the previous N−1 days. */
const calendarStart = (days: number) => {
  const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  return new Date(today - (days - 1) * 86_400_000);
};

async function reference(siteId: string, host: string, days: number) {
  const start = calendarStart(days);
  const pv = db`website_id = ${siteId} AND event_type = 'pageview' AND occurred_at >= ${start} AND occurred_at <= now()`;
  // Sessions belong to the window their first pageview falls in, with all their
  // pageviews — how the rollups count sessions, bounces, channels and entry/exit pages.
  const lookback = new Date(start.getTime() - 86_400_000);
  const sessionPv = db`website_id = ${siteId} AND event_type = 'pageview' AND occurred_at >= ${lookback} AND occurred_at <= now()
    AND session_id IN (
      SELECT session_id FROM analytics_events
      WHERE website_id = ${siteId} AND event_type = 'pageview' AND occurred_at >= ${lookback} AND occurred_at <= now()
        AND session_id IS NOT NULL
      GROUP BY session_id HAVING min(occurred_at) >= ${start})`;

  const [totals] = await db`
    SELECT count(*)::int pv, count(DISTINCT ${VKEY})::int uv,
           (SELECT count(DISTINCT session_id)::int FROM analytics_events WHERE ${sessionPv}) sessions
    FROM analytics_events WHERE ${pv}`;
  const [bounce] = await db`
    SELECT count(*) FILTER (WHERE n = 1)::int bounced, count(*)::int sessions
    FROM (SELECT session_id, count(*) n FROM analytics_events WHERE ${sessionPv} GROUP BY session_id) s`;
  const daily = await db`
    SELECT to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') d, count(*)::int views, count(DISTINCT ${VKEY})::int uv
    FROM analytics_events WHERE ${pv} GROUP BY 1 ORDER BY 1`;
  const dim = async (expr: any) => db`
    SELECT ${expr} k, count(*)::int views, count(DISTINCT ${VKEY})::int uv
    FROM analytics_events WHERE ${pv} AND ${expr} IS NOT NULL AND length(trim(${expr})) > 0
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`;
  // Sessions by how they arrived: the session's first non-internal pageview's channel,
  // known sources winning over direct. All pageviews of the session count toward it.
  const sessions = db`
    SELECT session_id,
           coalesce(max(channel) FILTER (WHERE channel NOT IN ('internal', 'direct')), 'direct') channel,
           coalesce(max(${DOMAIN}) FILTER (WHERE channel <> 'internal'), 'direct') domain,
           count(*) n, max(${VKEY}) vk
    FROM analytics_events WHERE ${sessionPv} GROUP BY session_id`;
  const channels = await db`
    SELECT channel k, sum(n)::int views, count(*)::int sessions, count(DISTINCT vk)::int uv
    FROM (${sessions}) s GROUP BY 1 ORDER BY 2 DESC, 1`;
  const referrers = await db`
    SELECT domain k, sum(n)::int views, count(DISTINCT vk)::int uv
    FROM (${sessions}) s GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`;
  // Revenue still reads purchases over a rolling window ("now minus N days").
  const [revenue] = await db`
    SELECT coalesce(sum((properties->>'revenue')::numeric), 0)::float total, count(*)::int orders
    FROM analytics_events WHERE website_id = ${siteId} AND event_type = 'purchase'
      AND occurred_at >= ${new Date(Date.now() - days * 86_400_000)} AND occurred_at <= now()`;
  const custom = await db`
    SELECT event_type, count(*)::int n FROM analytics_events
    WHERE website_id = ${siteId} AND event_type <> 'pageview' AND occurred_at >= ${start} AND occurred_at <= now()
    GROUP BY 1 ORDER BY 1`;
  const edge = (dir: "ASC" | "DESC") => db`
    SELECT page, count(*)::int sessions FROM (
      SELECT DISTINCT ON (session_id) session_id, ${PATH} page FROM analytics_events WHERE ${sessionPv}
      ORDER BY session_id, occurred_at ${db.unsafe(dir)}, id ${db.unsafe(dir)}) s
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 5`;
  const hourlyDays = Math.min(days, 7);
  const [hourly] = await db`
    SELECT count(*)::int pv FROM analytics_events
    WHERE website_id = ${siteId} AND event_type = 'pageview'
      AND occurred_at >= ${calendarStart(hourlyDays)} AND occurred_at <= now()`;
  // The bench goals (see ensureGoals): a pageview goal on /pricing, an event goal on signup.
  const [pricingGoal] = await db`
    SELECT count(*)::int completions, count(DISTINCT ${VKEY})::int uv FROM analytics_events
    WHERE ${pv} AND coalesce(nullif(rtrim(${PATH}, '/'), ''), '/') = '/pricing'`;
  const [signupGoal] = await db`
    SELECT count(*)::int completions, count(DISTINCT ${VKEY})::int uv FROM analytics_events
    WHERE website_id = ${siteId} AND event_type = 'signup' AND occurred_at >= ${start} AND occurred_at <= now()`;
  const pageUtm = await db`
    SELECT ${PATH} page, utm_source, utm_medium, utm_campaign, count(*)::int views, count(DISTINCT ${VKEY})::int uv
    FROM analytics_events WHERE ${pv} AND coalesce(utm_source, utm_medium, utm_campaign) IS NOT NULL
    GROUP BY 1, 2, 3, 4 ORDER BY 5 DESC, 1, 2, 3, 4 LIMIT 200`;
  // Sessions by their first three pages, for path-analysis.
  const paths = await db`
    SELECT array_to_string(seq, ' → ') k, count(*)::int sessions FROM (
      SELECT (array_agg(${PATH} ORDER BY occurred_at, id))[1:3] seq
      FROM analytics_events WHERE ${sessionPv} GROUP BY session_id) s
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 200`;
  return {
    pricingGoal, signupGoal, pageUtm, paths,
    totals, bounce, daily, channels, referrers, revenue, custom, hourly, hourlyDays,
    entry: await edge("ASC"), exit: await edge("DESC"),
    pages: await dim(PATH), countries: await dim(db`country`), browsers: await dim(NAME("browser")),
    devices: await dim(db`device`), os: await dim(NAME("os")), cities: await dim(db`city`), languages: await dim(db`language`),
  };
}

// ─── Checks ──────────────────────────────────────────────────────────────────

// Tolerances (DRIFT for counts, U(...) for HyperLogLog uniques) are in lib/checks.ts.

function checksFor(r: Awaited<ReturnType<typeof reference>>, api: Record<string, any>, host: string): Check[] {
  const { out, eq, near, rule } = checker();
  const siteHost = new URL(host).host;
  // Top lists compare values and counts; rank ties within drift may swap, so the
  // comparison is on the set of the top 10 with their counts.
  const top = (endpoint: string, list: any[] | undefined, key: string, ref: any[]) => {
    const want = new Map(ref.map((x) => [x.k, [x.views, x.uv]]));
    const got = (list ?? []).slice(0, ref.length);
    eq(endpoint, `top ${ref.length} ${key} (value, views, unique)`,
      ref.map((x) => [x.k, x.views, U(x.uv)]),
      got.map((x) => (want.has(x[key]) ? [x[key], x.views, x.unique] : [x[key], "(not in reference top)"]))
        .sort((a, b) => ref.findIndex((x) => x.k === a[0]) - ref.findIndex((x) => x.k === b[0])));
  };

  const d = api["dashboard"];
  eq("dashboard", "page_views", r.totals.pv, d?.page_views);
  eq("dashboard", "unique_visitors", U(r.totals.uv), d?.unique_visitors);
  eq("dashboard", "sessions", r.totals.sessions, d?.sessions);
  near("dashboard", "bounce_rate % (sessions with one pageview)", (100 * r.bounce.bounced) / r.bounce.sessions, d?.bounce_rate);
  near("dashboard", "pages_per_session", r.totals.pv / r.totals.sessions, d?.metrics?.pages_per_session, 0.01);

  const ds = api["daily-stats"]?.daily_stats ?? [];
  eq("daily-stats", "sum of daily views = pageviews", r.totals.pv, ds.reduce((s: number, x: any) => s + x.views, 0));
  eq("daily-stats", "per-day views and unique (UTC)", r.daily.map((x) => [x.d, x.views, U(x.uv)]),
    ds.filter((x: any) => x.views > 0).map((x: any) => [x.date, x.views, x.unique]));
  eq("activity-trends", "matches daily-stats", ds, api["activity-trends"]?.daily_stats);

  const hs = api["hourly-stats"]?.hourly_stats ?? [];
  eq("hourly-stats", `sum of hourly views = pageviews over ${r.hourlyDays}d (documented 7-day cap)`, r.hourly.pv,
    hs.reduce((s: number, x: any) => s + x.views, 0));

  const pages = api["top-pages"]?.top_pages ?? [];
  top("top-pages", pages, "page", r.pages);
  rule("top-pages", "pages are paths (no scheme, host, query or fragment)",
    pages.length > 0 && pages.every((p: any) => p.page.startsWith("/") && !/[?#]/.test(p.page)), pages.slice(0, 3).map((p: any) => p.page));
  top("top-countries", api["top-countries"]?.top_countries, "country", r.countries);
  const browsers = api["top-browsers"]?.top_browsers ?? [];
  top("top-browsers", browsers, "browser", r.browsers);
  rule("top-browsers", "browsers grouped by name, not version",
    browsers.every((b: any) => !/\d/.test(b.browser)), browsers.slice(0, 4).map((b: any) => b.browser));
  top("top-devices", api["top-devices"]?.top_devices, "device", r.devices);
  const os = api["top-os"]?.top_os ?? [];
  top("top-os", os, "os", r.os);
  rule("top-os", "operating systems grouped by name, not version",
    os.every((o: any) => !/\d/.test(o.os)), os.slice(0, 4).map((o: any) => o.os));
  top("top-cities", api["top-cities"]?.top_cities, "city", r.cities);
  top("top-languages", api["top-languages"]?.top_languages, "language", r.languages);

  const bulk = api["dimensions-bulk"] ?? {};
  for (const [key, ep, field] of [
    ["top_pages", "top-pages", "top_pages"], ["top_referrers", "top-referrers", "top_referrers"],
    ["top_countries", "top-countries", "top_countries"], ["top_browsers", "top-browsers", "top_browsers"],
    ["top_devices", "top-devices", "top_devices"], ["top_os", "top-os", "top_os"],
  ] as const) eq("dimensions-bulk", `${key} = ${ep}`, api[ep]?.[field], bulk[key]);

  const refs = api["top-referrers"]?.top_referrers ?? [];
  top("top-referrers", refs, "referrer", r.referrers);
  rule("top-referrers", "referrers are domains or 'direct'",
    refs.every((x: any) => x.referrer === "direct" || !/[/:?#]/.test(x.referrer)), refs.slice(0, 4).map((x: any) => x.referrer));
  rule("top-referrers", "site's own host never listed as a referrer",
    !refs.some((x: any) => String(x.referrer).includes(siteHost)), refs.slice(0, 5).map((x: any) => x.referrer));

  const ts = api["traffic-summary"] ?? {};
  eq("traffic-summary", "total_views = pageviews", r.totals.pv, ts.total_views);
  eq("traffic-summary", "total_visitors = unique visitors", U(r.totals.uv), ts.total_visitors);
  eq("traffic-summary", "channels by how sessions arrived (views, sessions, unique)",
    Object.fromEntries(r.channels.map((x) => [x.k, [x.views, x.sessions, U(x.uv)]])),
    Object.fromEntries((ts.channels ?? []).map((c: any) => [c.channel, [c.views, c.sessions, c.unique_visitors]])));
  rule("traffic-summary", "in-site navigation is never a channel",
    !(ts.channels ?? []).some((c: any) => c.channel === "internal"), (ts.channels ?? []).map((c: any) => c.channel));

  const rev = api["revenue"] ?? {};
  near("revenue", "total_revenue", r.revenue.total, rev.summary?.total_revenue, 0.5);
  eq("revenue", "orders", r.revenue.orders, rev.summary?.orders);
  const bySource = rev.by_source ?? [];
  rule("revenue", "site's own host never credited as a revenue source",
    !bySource.some((x: any) => String(x.name).includes(siteHost)), bySource.slice(0, 4).map((x: any) => x.name));
  near("revenue", "by_source revenue sums to total", rev.summary?.total_revenue ?? 0,
    bySource.reduce((s: number, x: any) => s + x.revenue, 0), 1);
  rule("revenue", "referrer-based mediums are real channels, not all 'organic'",
    !(rev.by_medium ?? []).some((x: any) => x.name === "internal"), (rev.by_medium ?? []).map((x: any) => x.name));

  const vi = api["visitor-insights"]?.visitor_insights ?? {};
  eq("visitor-insights", "new + returning = unique visitors", U(r.totals.uv), (vi.new_visitors ?? 0) + (vi.returning_visitors ?? 0));
  eq("visitor-insights", "top 5 entry pages (by path)", r.entry.map((x) => [x.page, x.sessions]),
    (vi.top_entry_pages ?? []).slice(0, 5).map((x: any) => [x.page, x.sessions]));
  eq("visitor-insights", "top 5 exit pages (by path)", r.exit.map((x) => [x.page, x.sessions]),
    (vi.top_exit_pages ?? []).slice(0, 5).map((x: any) => [x.page, x.sessions]));

  const geo = api["geolocation-breakdown"] ?? {};
  eq("geolocation-breakdown", "country visitors = top-countries unique",
    Object.fromEntries((api["top-countries"]?.top_countries ?? []).slice(0, 5).map((x: any) => [x.country, x.unique])),
    Object.fromEntries((geo.countries ?? []).filter((c: any) => (api["top-countries"]?.top_countries ?? []).slice(0, 5).some((x: any) => x.country === c.code)).map((c: any) => [c.code, c.count])));

  const ce = api["custom-events"] ?? {};
  eq("custom-events", "count per non-pageview event type", r.custom.map((x) => [x.event_type, x.n]),
    (ce.events ?? []).map((x: any) => [x.event_type, x.count]).sort((a: any, b: any) => a[0].localeCompare(b[0])));

  const goals = api["goals-stats"]?.goals ?? [];
  const goal = (target: string) => goals.find((g: any) => g.target === target);
  eq("goals-stats", "pageview goal /pricing (completions, unique)",
    [r.pricingGoal.completions, U(r.pricingGoal.uv)], [goal("/pricing/")?.completions, goal("/pricing/")?.unique_visitors]);
  eq("goals-stats", "event goal signup (completions, unique)",
    [r.signupGoal.completions, U(r.signupGoal.uv)], [goal("signup")?.completions, goal("signup")?.unique_visitors]);

  // Ties in views at the 10th place may keep different rows on each side, so the check
  // is tie-safe: the top 10 view counts must match, and each returned row must carry
  // the reference's counts for that page and tag combination.
  const utmKey = (x: any) => [x.page, x.utm_source, x.utm_medium, x.utm_campaign].join("|");
  const utmRef = new Map(r.pageUtm.map((x: any) => [utmKey(x), x]));
  const utmApi = (api["page-utm-breakdown"]?.breakdown ?? []).slice(0, 10);
  eq("page-utm-breakdown", "top 10 views", r.pageUtm.slice(0, 10).map((x: any) => x.views), utmApi.map((x: any) => x.views));
  eq("page-utm-breakdown", "top 10 rows (key, views, unique)",
    utmApi.map((x: any) => { const ref: any = utmRef.get(utmKey(x)); return [utmKey(x), ref?.views ?? null, U(ref?.uv ?? -1)]; }),
    utmApi.map((x: any) => [utmKey(x), x.views, x.unique_visitors]));

  // Same tie-safe shape as page-utm: the top 10 session counts, then each returned
  // path's count against the reference's.
  const pathKey = (x: any) => [x.page_1, x.page_2, x.page_3].filter((p) => p != null && p !== "").join(" → ");
  const pathRef = new Map(r.paths.map((x: any) => [x.k, x.sessions]));
  const pathApi = (api["path-analysis"]?.paths ?? []).slice(0, 10);
  eq("path-analysis", "top 10 session counts", r.paths.slice(0, 10).map((x: any) => x.sessions), pathApi.map((x: any) => x.sessions));
  eq("path-analysis", "top 10 paths (first three pages, sessions)",
    pathApi.map((x: any) => [pathKey(x), pathRef.get(pathKey(x)) ?? null]),
    pathApi.map((x: any) => [pathKey(x), x.sessions]));

  const rt = api["realtime"] ?? {};
  rule("realtime", "site's own host never a top referrer",
    !(rt.top_referrers ?? []).some((x: any) => String(x.name).includes(siteHost)), (rt.top_referrers ?? []).slice(0, 3));

  for (const ep of ENDPOINTS) {
    if (api[ep] === undefined) out.push({ endpoint: ep, check: "responds 200", ok: false, actual: "non-200, timeout or unparseable" });
  }
  return out;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

/** The goals the goals-stats checks expect, recreated on every run. */
async function ensureGoals(siteId: string) {
  await db`DELETE FROM goals WHERE website_id = ${siteId}::uuid AND name LIKE 'bench:%'`;
  await db`
    INSERT INTO goals (website_id, name, type, identifier) VALUES
      (${siteId}::uuid, 'bench: pricing', 'pageview', '/pricing/'),
      (${siteId}::uuid, 'bench: signup', 'event', 'signup')`;
}

const report: any[] = [];
let failures = 0;
for (const name of siteNames) {
  const site = state.sites[name];
  if (!site) { console.log(`no site "${name}" — run the seed`); continue; }
  await ensureGoals(site.id);
  const [{ n }] = await db`SELECT count(*)::int n FROM analytics_events WHERE website_id = ${site.id}`;
  for (const days of ranges) {
    console.log(`\n══ ${name} (${n.toLocaleString()} events) · ${days}d ══`);
    const api: Record<string, any> = {};
    const timings: Record<string, { cold: number; warm: number; status: number }> = {};
    for (const ep of ENDPOINTS) {
      const cold = await call(ep, site.id, days, true);
      const warm = await call(ep, site.id, days, false);
      timings[ep] = { cold: cold.ms, warm: warm.ms, status: cold.status };
      if (cold.status === 200) api[ep] = cold.body;
    }
    const ref = await reference(site.id, site.host, days);
    const checks = checksFor(ref, api, site.host);
    const slow = Object.entries(timings).sort((a, b) => b[1].cold - a[1].cold);
    console.log("  slowest cold: " + slow.slice(0, 6).map(([e, t]) => `${e} ${t.cold}ms`).join(", "));
    failures += printFailures(checks);
    report.push({ site: name, events: n, days, timings, checks });
  }
}

console.log(`\nsaved ${await saveResults("audit", report)}`);
await db.close();
process.exit(failures === 0 ? 0 : 1);
