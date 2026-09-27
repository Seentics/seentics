/**
 * Funnel report latency and correctness, for every seeded site's bench funnels
 * (`seed/funnels.sql`) over 7, 30 and 90 days.
 *
 *   bun funnels/bench.ts
 *
 * Each report is fetched cold (a unique parameter misses the caches) and compared with a
 * naive reference: distinct visitors per step over the same rolling window.
 */
import { SQL } from "bun";
import { session } from "../lib/api";
import { checker, printFailures, saveResults } from "../lib/checks";
import { DATABASE_URL, readState } from "../lib/config";

const state = await readState();
const db = new SQL(DATABASE_URL);
const { get } = session(state);

const report: any[] = [];
let failures = 0;
for (const [name, site] of Object.entries(state.sites)) {
  const funnels = await db`SELECT id::text FROM funnels WHERE website_id = ${site.id}::uuid AND name LIKE 'bench:%' ORDER BY name`;
  if (funnels.length === 0) continue;
  const [{ n }] = await db`
    SELECT count(*)::int n FROM analytics_events
    WHERE website_id = ${site.id} AND event_type IN ('funnel_step', 'funnel_complete')`;
  console.log(`\n══ ${name}: ${funnels.length} funnels, ${n.toLocaleString()} funnel events ══`);

  for (const days of [7, 30, 90]) {
    const { out, eq } = checker();
    const times: number[] = [];
    for (const { id } of funnels) {
      const res = await get(`/api/v1/websites/${site.id}/funnels/${id}/stats?days=${days}`, true);
      times.push(res.ms);
      const funnel = res.body?.data;
      const start = new Date(Date.now() - days * 86_400_000);
      const ref = await db`
        SELECT CASE WHEN event_type = 'funnel_complete' THEN -1 ELSE (properties->>'step')::int END step,
               count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int uv
        FROM analytics_events
        WHERE website_id = ${site.id} AND event_type IN ('funnel_step', 'funnel_complete')
          AND properties->>'funnel_id' = ${id} AND occurred_at >= ${start} AND occurred_at <= now()
        GROUP BY 1`;
      const at = (s: number) => ref.find((r: any) => r.step === s)?.uv ?? 0;
      eq("funnel-stats", `${days}d funnel ${id}: visitors per step, then completions`,
        [at(0), at(1), at(2), at(3), at(-1)],
        funnel ? [...funnel.stepBreakdown.map((s: any) => s.count), funnel.completions] : `status ${res.status}`);
    }
    times.sort((a, b) => a - b);
    console.log(`  ${String(days).padStart(2)}d cold: ${times.map((t) => `${t}ms`).join(", ")}`);
    failures += printFailures(out);
    report.push({ site: name, days, times, checks: out });
  }
}

console.log(`\nsaved ${await saveResults("funnels", report)}`);
await db.close();
process.exit(failures === 0 ? 0 : 1);
