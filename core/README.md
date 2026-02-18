# Seentics Core

The Go backend powering Seentics — handles analytics ingestion, heatmaps, session replays, funnels, automations, and the tracker configuration API.

## Architecture

```
                 ┌──────────────┐
                 │  Gin Router  │
                 └──────┬───────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
  ┌────┴────┐    ┌──────┴──────┐   ┌────┴────┐
  │  Auth   │    │  Analytics  │   │ Tracker │
  │ Module  │    │   Module    │   │ Config  │
  └─────────┘    └─────────────┘   └─────────┘
       │                │                │
  ┌────┴────┐    ┌──────┴──────┐   ┌────┴────┐
  │Heatmaps │    │  Funnels    │   │Replays  │
  │ Module  │    │   Module    │   │ Module  │
  └─────────┘    └─────────────┘   └─────────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
    ┌───────────┬───────┼───────┬──────────┐
    │           │       │       │          │
 Postgres  ClickHouse  Redis   NATS     MinIO
(metadata)  (events)  (cache) (stream) (replays)
```

Events flow in through the HTTP API, get published to NATS JetStream for async processing, batched, and stored in ClickHouse (with PostgreSQL fallback). Session replay chunks go to S3-compatible storage (MinIO locally).

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Go 1.24 |
| Framework | Gin |
| Analytics DB | ClickHouse |
| Metadata DB | PostgreSQL 15 |
| Streaming | NATS JetStream |
| Cache | Redis 7 |
| Object Storage | S3-compatible (MinIO) |

## Project Structure

```
core/
├── cmd/api/
│   └── main.go              # Entry point, router setup
├── internal/
│   ├── modules/
│   │   ├── analytics/       # Event tracking, dashboards, metrics
│   │   ├── auth/            # Authentication (JWT, registration, login)
│   │   ├── automations/     # Behavioral workflow engine
│   │   ├── funnels/         # Multi-step conversion tracking
│   │   ├── heatmaps/       # Click, scroll, and pointer tracking
│   │   ├── replays/         # Session recording and playback
│   │   └── websites/        # Site management, tracker config, goals
│   └── shared/
│       ├── config/          # Environment configuration
│       ├── database/        # PostgreSQL + ClickHouse connections
│       ├── middleware/      # Auth, CORS, rate limiting, request logging
│       ├── migrations/      # Auto-run SQL migrations
│       ├── nats/            # NATS JetStream producer/consumer
│       ├── storage/         # S3-compatible object storage
│       └── utils/           # Geolocation, helpers
├── Dockerfile               # Production image
├── Dockerfile.dev           # Dev image with Air hot reload
└── go.mod
```

Each module follows the same pattern: `handlers/` → `services/` → `repository/` → `models/`.

## Quick Start

```bash
# From the repo root
cp core/.env.example core/.env
docker compose up --build
```

The backend starts on `:3002`. Migrations run automatically on boot.

## Running Standalone

```bash
cd core
go mod download
cp .env.example .env  # Edit with your DB credentials

# Build and run
go build -o server ./cmd/api/
./server
```

Prerequisites: PostgreSQL 15+, Redis 7+, NATS 2.10+, ClickHouse (optional, falls back to Postgres).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string |
| `NATS_URL` | `nats://localhost:4222` | NATS server |
| `NATS_SUBJECT_EVENTS` | `analytics.events` | NATS subject for events |
| `JWT_SECRET` | — | JWT signing secret |
| `CLICKHOUSE_HOST` | `localhost` | ClickHouse host |
| `CLICKHOUSE_PORT` | `9000` | ClickHouse native port |
| `CLICKHOUSE_DB` | `seentics` | ClickHouse database name |
| `S3_ENDPOINT` | `http://minio:9000` | S3-compatible endpoint |
| `S3_BUCKET_REPLAYS` | `seentics-replays` | Bucket for replay chunks |
| `CLOUD_ENABLED` | `false` | Accept gateway headers for enterprise mode |
| `IS_ENTERPRISE` | `false` | Enable enterprise features |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

## API Endpoints

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/analytics/event` | Track single event |
| `POST` | `/api/v1/analytics/batch` | Track batch events |
| `POST` | `/api/v1/heatmaps/record` | Record heatmap data |
| `POST` | `/api/v1/replays/record` | Record replay chunk |
| `POST` | `/api/v1/funnels/track` | Track funnel event |
| `GET` | `/api/v1/tracker/config/:site_id` | Get tracker config |
| `GET` | `/health` | Health check |

### Protected (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/analytics/dashboard/:website_id` | Dashboard metrics |
| `GET` | `/api/v1/analytics/live-visitors/:website_id` | Real-time visitors |
| `GET` | `/api/v1/analytics/top-pages/:website_id` | Top pages |
| `GET` | `/api/v1/analytics/top-referrers/:website_id` | Top referrers |
| `GET` | `/api/v1/analytics/top-countries/:website_id` | Geo breakdown |
| `CRUD` | `/api/v1/user/websites` | Manage websites |
| `CRUD` | `/api/v1/websites/:id/automations` | Manage automations |
| `CRUD` | `/api/v1/websites/:id/funnels` | Manage funnels |
| `GET` | `/api/v1/heatmaps/data` | Heatmap data |
| `GET` | `/api/v1/replays/sessions` | Session list |
| `GET` | `/api/v1/replays/data/:session_id` | Replay playback |

### Auth Modes

**OSS mode** (`CLOUD_ENABLED=false`): Validates JWT Bearer tokens directly.

**Enterprise mode** (`CLOUD_ENABLED=true`): Accepts `X-API-Key` header from the enterprise gateway and reads user context from gateway-injected headers (`X-User-ID`, `X-User-Email`, `X-User-Plan`, `X-User-Role`).

## Development

```bash
# Run tests
go test ./...

# Build
go build ./cmd/api/

# Lint
golangci-lint run
```

## License

AGPL v3.0 — See [LICENSE](../LICENSE) for details.
