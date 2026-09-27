/**
 * Register a benchmark account, create three websites of different sizes through the
 * API and fill each with 90 days of realistic history (`dashboards.sql`) and funnel
 * traffic (`funnels.sql`). Records the account and sites in the state file for the
 * feature benchmarks. A fourth, empty site takes the k6 ingest load.
 *
 *   bun seed/seed.ts                 small 10k, medium 250k, large 1M sessions
 *   bun seed/seed.ts --scale 0.1     a tenth of that, for a quick run
 *
 * Bulk-loads the way Postgres wants: `analytics_events` carries ~20 secondary indexes,
 * and inserting millions of rows into them maintains every index row by row — random
 * I/O that took 20+ minutes for a few million events. So the indexes are dropped, the
 * rows loaded bare, and each index rebuilt in one sorted pass with parallel workers.
 * Their definitions are saved to results/index-defs.sql first, and the rebuild runs in
 * a `finally`, so a failed load never leaves the table without them.
 */
import { $ } from "bun";
import { createWebsite, register, session } from "../lib/api";
import { DB_NAME, DB_USER, PG_CONTAINER, RESULTS_DIR, STATE_FILE, writeState, type State } from "../lib/config";

const scaleIdx = process.argv.indexOf("--scale");
const scale = scaleIdx >= 0 ? Number(process.argv[scaleIdx + 1]) : 1;

const SIZES = [
  { name: "small", sessions: 10_000, seed: 0.11 },
  { name: "medium", sessions: 250_000, seed: 0.22 },
  { name: "large", sessions: 1_000_000, seed: 0.33 },
];

const psql = (sql: string) => $`docker exec -i ${PG_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -qAt -v ON_ERROR_STOP=1 -c ${sql}`.text();
const psqlFile = (file: string, vars: Record<string, string | number>) => {
  const args = Object.entries(vars).flatMap(([k, v]) => ["-v", `${k}=${v}`]);
  return $`docker exec -i ${PG_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -q -v ON_ERROR_STOP=1 ${args} < ${Bun.file(new URL(file, import.meta.url))}`.text();
};
const secs = (t0: number) => `${((performance.now() - t0) / 1000).toFixed(1)}s`;

// ── Account ───────────────────────────────────────────────────────────────────
// BENCH_EMAIL and BENCH_PASSWORD name an account that already exists and already has
// its plan — the seentics-cloud demo creates one account for every product and seeds
// them all into it. Without them the seed registers its own.
const givenAccount = process.env.BENCH_EMAIL && process.env.BENCH_PASSWORD
  ? { email: process.env.BENCH_EMAIL, password: process.env.BENCH_PASSWORD }
  : null;
const existing = Bun.file(STATE_FILE);
const state: State = (await existing.exists())
  ? await existing.json()
  : { ...(givenAccount ?? { email: `bench-${Date.now()}@seentics.test`, password: "Bench-password-2026!" }), sites: {} };

if (Object.keys(state.sites).length === 0 && !givenAccount) {
  const { userId } = await register(state.email, state.password);
  console.log(`registered ${state.email}`);
  // Where accounts have plans (seentics-cloud), a fresh one is on the free tier, whose
  // website and event quotas the seed and the load would exhaust at once. Put it on
  // the top bundle with those quotas unlimited, as an admin override would. A
  // standalone install has no plans and skips this.
  if ((await psql(`SELECT to_regclass('subscription_limit_overrides') IS NOT NULL`)).trim() === "t") {
    const subscriptionId = (await psql(`
      INSERT INTO subscriptions (user_id, plan_id, status) VALUES ('${userId}', 'suite-business', 'active')
      ON CONFLICT (user_id, plan_id) WHERE status = 'active' DO UPDATE SET updated_at = NOW()
      RETURNING id`)).trim();
    await psql(`
      INSERT INTO subscription_limit_overrides (subscription_id, product, key, value) VALUES
        ('${subscriptionId}', 'core', 'monthly_events', -1),
        ('${subscriptionId}', 'core', 'websites', -1),
        ('${subscriptionId}', 'core', 'replays', -1),
        ('${subscriptionId}', 'core', 'heatmaps', -1)
      ON CONFLICT (subscription_id, product, key) DO UPDATE SET value = EXCLUDED.value`);
    console.log("plan: suite-business with unlimited quota overrides");
  }
}

// ── Websites, created first so a load failure never leaves half-registered sites ──
// BENCH_SITE_NAMES renames the sites (JSON: {"large": "Acme Store", …}), and
// BENCH_NO_INGEST_SITE=1 leaves out the empty site k6 load writes to — both for the demo,
// where the sites are what someone browses.
const siteNames: Record<string, string> = JSON.parse(process.env.BENCH_SITE_NAMES ?? "{}");
const extraSites = process.env.BENCH_NO_INGEST_SITE === "1" ? [] : [{ name: "ingest", sessions: 0, seed: 0 }];
const { auth } = session(state);
const token = await auth();
for (const size of [...SIZES, ...extraSites]) {
  if (state.sites[size.name]) continue;
  const host = `https://${size.name}.seentics.test`;
  const website = await createWebsite(token, siteNames[size.name] ?? `Bench ${size.name}`, host);
  state.sites[size.name] = { id: website.id, host, sessions: Math.round(size.sessions * scale) };
}
await writeState(state);

// ── Drop the secondary indexes (definitions saved first) ────────────────────────
const defs = (await psql(`SELECT indexdef FROM pg_indexes WHERE tablename = 'analytics_events' ORDER BY indexname`))
  .trim().split("\n").filter(Boolean)
  // pg_indexes shows the parent's definition as "ON ONLY", which would create an
  // invalid parent index and no partition indexes. Without ONLY it cascades.
  .map((d) => d.replace(" ON ONLY ", " ON "));
await Bun.write(`${RESULTS_DIR}index-defs.sql`, defs.join(";\n") + ";\n");
const names = defs.filter((d) => !d.includes("UNIQUE") && !/_pkey\b/.test(d))
  .map((d) => d.match(/INDEX (\S+) ON/)![1]);
console.log(`dropping ${names.length} indexes (definitions saved to results/index-defs.sql)`);
await psql(`DROP INDEX IF EXISTS ${names.join(", ")}`);

const total = performance.now();
try {
  for (const size of SIZES) {
    const site = state.sites[size.name]!;
    const t0 = performance.now();
    const out = await psqlFile("./dashboards.sql", { site: site.id, host: site.host, sessions: site.sessions, seed: size.seed });
    const counts = out.trim().split("\n").filter((l) => /^\s*\w+\s*\|\s*\d+/.test(l)).map((l) => l.replace(/\s+/g, " ").trim()).join(", ");
    await psqlFile("./funnels.sql", { site: site.id });
    console.log(`  ${size.name.padEnd(6)} ${site.sessions.toLocaleString()} sessions → ${counts}  (${secs(t0)})`);
  }
} finally {
  // ── Rebuild, one sorted pass per index, with parallel workers ────────────────
  const t0 = performance.now();
  const rebuild = [
    "SET maintenance_work_mem = '1GB'",
    "SET max_parallel_maintenance_workers = 3",
    ...defs.filter((d) => names.some((n) => d.includes(`INDEX ${n} ON`))),
    "ANALYZE analytics_events",
  ].join(";\n") + ";";
  await $`docker exec -i ${PG_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -q -v ON_ERROR_STOP=1 < ${new Response(rebuild)}`;
  console.log(`rebuilt ${names.length} indexes + ANALYZE (${secs(t0)})`);
}
const [n] = (await psql(`SELECT count(*) FROM analytics_events`)).trim().split("\n");
console.log(`done: ${Number(n).toLocaleString()} rows in analytics_events, total ${secs(total)}`);

// The rows went straight into the table, not through ingest, so nothing marked their
// days stale for the rollups. Mark them; the next rollup build picks them up. (No
// rollup tables — Postgres without `hll` — means the dashboards read raw events.)
if ((await psql(`SELECT to_regclass('analytics_rollup_stale') IS NOT NULL`)).trim() === "t") {
  const ids = Object.values(state.sites).map((s) => `'${s.id}'`).join(", ");
  await psql(`
    INSERT INTO analytics_rollup_stale (website_id, day)
    SELECT DISTINCT website_id, (occurred_at AT TIME ZONE 'UTC')::date FROM analytics_events
    WHERE website_id IN (${ids})
    ON CONFLICT (website_id, day) DO UPDATE SET staled_at = now()`);
  console.log("marked seeded days stale for the rollups (built within a few minutes)");
}
