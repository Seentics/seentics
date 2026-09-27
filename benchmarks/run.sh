#!/usr/bin/env bash
# Seentics benchmarks: millions of rows, then each feature checked for correctness
# against a reference query and timed cold.
#
#   benchmarks/run.sh up           build and start the production stack for benchmarking
#   benchmarks/run.sh seed [--scale 0.1]
#                                  load ~4.8M events over 90 days into three sites
#   benchmarks/run.sh wait         block until the rollups have caught up with the seed
#   benchmarks/run.sh analytics    audit every dashboard endpoint (7/30/90 days)
#   benchmarks/run.sh funnels      funnel reports
#   benchmarks/run.sh all          every feature benchmark above
#   benchmarks/run.sh k6           k6 load (SCENARIO=ingest|dashboard|mixed RATE DURATION SITE)
#   benchmarks/run.sh down         stop and delete the stack, volumes included
#
# To benchmark another deployment of this API, set BENCH_API, BENCH_DATABASE_URL and
# BENCH_PG_CONTAINER (see lib/config.ts) and skip `up`.
set -euo pipefail

BENCH_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$BENCH_DIR")"

compose() {
  docker compose -p seentics-oss-bench \
    --project-directory "$REPO_DIR" \
    --env-file "$BENCH_DIR/bench.env" \
    -f "$REPO_DIR/docker-compose.production.yml" \
    -f "$BENCH_DIR/docker-compose.bench.yml" "$@"
}

psql_bench() {
  docker exec -i "${BENCH_PG_CONTAINER:-seentics-oss-bench-postgres-1}" \
    psql -U "${BENCH_DB_USER:-seentics}" -d "${BENCH_DB_NAME:-seentics}" -qAt "$@"
}

wait_rollups() {
  # Nothing to wait for without rollups (Postgres without `hll`).
  [ "$(psql_bench -c "SELECT to_regclass('analytics_rollup_stale') IS NOT NULL")" = "t" ] || return 0
  while :; do
    left=$(psql_bench -c "SELECT count(*) FROM analytics_rollup_stale")
    [ "$left" = "0" ] && { echo "rollups up to date"; return 0; }
    echo "rollups: $left site-days left to build"
    sleep 20
  done
}

cd "$BENCH_DIR"
case "${1:-}" in
  up)        compose up -d --build --wait ;;
  seed)      shift; bun seed/seed.ts "$@" ;;
  wait)      wait_rollups ;;
  analytics) shift; wait_rollups; bun analytics/audit.ts "$@" ;;
  funnels)   wait_rollups; bun funnels/bench.ts ;;
  all)       wait_rollups; bun analytics/audit.ts; bun funnels/bench.ts ;;
  k6)
    # k6 in a container on CPUs the stack does not use. It reaches the API through the
    # host (host.docker.internal), where the stack publishes it.
    api="${BENCH_API:-http://127.0.0.1:8001}"
    api="${api/127.0.0.1/host.docker.internal}"
    api="${api/localhost/host.docker.internal}"
    docker run --rm --add-host host.docker.internal:host-gateway \
      --cpuset-cpus "${BENCH_CLIENT_CPUS:-4-9}" \
      -v "$BENCH_DIR/k6:/scripts:ro" \
      -e BENCH_API="$api" \
      -e BENCH_STATE="$(cat "${BENCH_STATE_FILE:-$BENCH_DIR/.state/state.json}")" \
      -e SCENARIO="${SCENARIO:-mixed}" -e RATE="${RATE:-200}" -e DURATION="${DURATION:-60s}" \
      -e SITE="${SITE:-large}" -e MAX_VUS="${MAX_VUS:-2000}" \
      grafana/k6:latest run --quiet /scripts/load.js
    ;;
  down)      compose down -v ;;
  compose)   shift; compose "$@" ;;
  *) sed -n '2,19p' "$0"; exit 1 ;;
esac
