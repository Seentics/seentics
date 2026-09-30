# Production deployment

Seentics ships a production Compose stack in `docker-compose.production.yml`. It
keeps Postgres, [objex](https://github.com/kajdesk/objex) (S3-compatible object
storage), and the core API on a private Docker network; Caddy is the only service
that listens on the host (ports 80 and 443). Dashboard API calls stay same-origin
through the Next.js server, while a separate TLS hostname serves only signed replay
and heatmap objects from objex.

Do not use `docker-compose.yml` for a public deployment. It is deliberately a
live-reload local-development stack with sample credentials and published service
ports.

## Before deployment

1. Create two DNS `A`/`AAAA` records pointing at the server:
   - `APP_DOMAIN`, such as `analytics.example.com`
   - `STORAGE_DOMAIN`, such as `storage.analytics.example.com`
2. Allow only TCP 80 and 443 to the server. Restrict SSH to your administration
   network. Do not expose 3000, 8080, 9000, or 5432.
3. Install Docker Engine and the Docker Compose plugin on a supported Linux host.
4. Copy `deploy/production.env.example` to a location outside the checkout (for
   example `/etc/seentics/production.env`), set owner-read-only permissions, and
   replace every `REPLACE_…` value. Use distinct secrets generated with
   `openssl rand -base64 48`.
5. Replace every image value with an immutable tag or digest after reviewing it.
   Floating `latest` tags are intentionally not accepted by the production
   Compose file.

## First deployment

From the repository root:

```bash
docker compose \
  --env-file /etc/seentics/production.env \
  -f docker-compose.production.yml \
  config --quiet

docker compose \
  --env-file /etc/seentics/production.env \
  -f docker-compose.production.yml \
  up -d --build
```

The first command validates that all required deployment variables are present
without starting anything. The API also refuses to start in production with
placeholder/short secrets, wildcard or implicit dashboard CORS, missing storage
credentials, or a non-HTTPS public storage URL.

Caddy obtains and renews certificates automatically once both DNS records resolve
to the host and ports 80/443 are reachable. Check readiness with:

```bash
docker compose --env-file /etc/seentics/production.env -f docker-compose.production.yml ps
curl -fsS https://analytics.example.com/api/v1/health
```

## Operations

Use the same `--env-file` and `-f docker-compose.production.yml` arguments for
every command.

```bash
# Follow structured core logs
docker compose --env-file /etc/seentics/production.env -f docker-compose.production.yml logs -f api

# Upgrade from a reviewed revision; make a database backup first.
git fetch --tags origin
git checkout <reviewed-tag-or-commit>
docker compose --env-file /etc/seentics/production.env -f docker-compose.production.yml up -d --build

# Inspect resource use
docker stats
```

The API runs its tracked SQL migrations during startup. Back up Postgres before
every upgrade and rehearse restore on a separate host. `AUTO_DB_PUSH` remains off
in production by default: do not use Drizzle schema push as a substitute for a
reviewed migration.

## Backups and retention

Back up both persistent volumes:

- `postgres-data` contains accounts, website configuration, and analytics metadata.
- `objex-data` contains replay chunks and heatmap layout snapshots.

Use your platform's encrypted volume snapshots or a scheduled logical Postgres
backup plus object-storage replication. Test a restore regularly. Configure data
retention to match your privacy policy; replay and heatmap objects can contain
customer interaction data even though tracker masking is enabled.

## External S3 instead of objex

The included single-node objex service is suitable for a single-host deployment.
`objex-init` creates the bucket and its CORS rule on every start; it is idempotent.
For managed object storage, remove `objex` and `objex-init`, set `S3_ENDPOINT`,
`S3_PUBLIC_ENDPOINT`, bucket, region, and least-privilege credentials on `api`, and
ensure the public endpoint is HTTPS and reachable from browsers. Keep the bucket
private: replay and heatmap access is granted through short-lived presigned URLs.

## Incident checklist

1. Rotate `JWT_SECRET`, `GLOBAL_API_KEY`, database credentials, and object-store
   credentials if they may have been exposed.
2. Revoke affected user sessions by rotating the JWT secret.
3. Review Caddy and API logs, preserving them according to your incident policy.
4. Verify backups and object-storage access policies before restoring service.
