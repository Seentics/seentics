#!/usr/bin/env bash
# Core's integration suite: the real HTTP app and repositories against a disposable
# Postgres (with the `hll` extension) and an S3-compatible store, both in Docker.
#
#   bun run test:integration            # start containers if needed, run every file
#   bun run test:integration privacy    # only files whose path matches "privacy"
#   KEEP=1 ...                          # leave the containers running afterwards (default: kept)
#   DOWN=1 ...                          # remove the containers afterwards
set -euo pipefail
cd "$(dirname "$0")/.."

PG=seentics-core-test-pg
S3=seentics-core-test-s3

if ! docker image inspect seentics-postgres:16-hll >/dev/null 2>&1; then
  docker build -q -t seentics-postgres:16-hll ../deploy/postgres >/dev/null
fi
if ! docker ps --format '{{.Names}}' | grep -qx "$PG"; then
  docker rm -f "$PG" >/dev/null 2>&1 || true
  docker run -d --name "$PG" -e POSTGRES_USER=seentics -e POSTGRES_PASSWORD=test \
    -e POSTGRES_DB=seentics_test -p 55432:5432 seentics-postgres:16-hll >/dev/null
fi
if ! docker ps --format '{{.Names}}' | grep -qx "$S3"; then
  docker rm -f "$S3" >/dev/null 2>&1 || true
  docker run -d --name "$S3" -e OBJEX_ACCESS_KEY=test-key -e OBJEX_SECRET_KEY=test-secret-key \
    -e OBJEX_REGION=auto -p 59000:9000 ghcr.io/kajdesk/objex:0.2.0 >/dev/null
fi
for _ in $(seq 1 60); do
  docker exec "$PG" pg_isready -U seentics -d seentics_test >/dev/null 2>&1 && break
  sleep 1
done
for _ in $(seq 1 60); do
  curl -s -o /dev/null http://localhost:59000/ && break
  sleep 1
done

files=$(find integration -name '*.integration.ts' | sort | grep -i "${1:-}" || true)
if [ -z "$files" ]; then echo "no integration files match '${1:-}'"; exit 1; fi
status=0
# One process per file: each composes its own application, and module-level caches start empty.
for f in $files; do
  bun test --preload ./integration/setup.ts "./$f" || status=1
done

if [ "${DOWN:-}" = "1" ]; then docker rm -f "$PG" "$S3" >/dev/null; fi
exit $status
