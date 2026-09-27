# Seentics benchmarks

Millions of rows, then every feature checked two ways: **correct** (each number
matches an independent reference query over the raw events) and **fast** (each
endpoint timed cold, missing every cache). The budget is under 1 second per request
on a 4-core server with 90 days of a 1M-session-a-quarter site.

```sh
benchmarks/run.sh up          # production stack, pinned to 4 cores, API on :8001
benchmarks/run.sh seed        # ~4.8M events over 90 days into three sites (~3 min)
benchmarks/run.sh all         # every feature benchmark, after the rollups catch up
benchmarks/run.sh down        # delete the stack and its data
```

`seed --scale 0.1` loads a tenth for a quick run. Results are printed and saved to
`results/<feature>-<time>.json`; each benchmark exits non-zero on a failed check, so
they can gate CI.

## Layout

| Path | What it is |
|---|---|
| `seed/seed.ts` | Registers an account, creates the `small` (10k sessions), `medium` (250k) and `large` (1M) sites plus an empty `ingest` site for load tests, and bulk-loads them. Drops the event indexes for the load and rebuilds them after. |
| `seed/dashboards.sql` | 90 days of sessions and pageviews for one site: channels, referrers, UTM tags, geography, devices, clicks, signups and purchases. |
| `seed/funnels.sql` | Three funnels per site and their step events with realistic drop-off. |
| `analytics/audit.ts` | Every dashboard endpoint at 7, 30 and 90 days. |
| `funnels/bench.ts` | Funnel reports. |
| `k6/load.js` | Sustained load: `SCENARIO=ingest\|dashboard\|mixed RATE=500 DURATION=2m benchmarks/run.sh k6`. |
| `lib/` | Where to point (`config.ts`), the API session (`api.ts`), tolerances and reporting (`checks.ts`). |

## Adding a feature

A new `<feature>/bench.ts` does three things:

1. If the seed does not already produce its data, add a `seed/<feature>.sql` and call
   it from `seed.ts` — through psql, in bulk, never row by row through the API.
2. For each seeded site and range, fetch the endpoint **cold** with `session().get(path, true)`
   and compare its numbers with a reference query written from what the number *means*,
   not copied from the repository — a copy repeats the bug it should catch.
3. Report with `checker()`, `printFailures()` and `saveResults()` from `lib/checks.ts`,
   and exit non-zero on a failure. Add it to `run.sh`.

Counts are held to `DRIFT` (0.05%), unique visitors to three standard errors of the
HyperLogLog estimate (`U(n)`, 3.5%).

## Other targets

The scripts talk to whatever `lib/config.ts` points at. Set `BENCH_API`,
`BENCH_DATABASE_URL`, `BENCH_PG_CONTAINER` and `BENCH_STATE_FILE` to benchmark another
deployment of this API — seentics-cloud's `benchmarks/run.sh` does this for its stack.
