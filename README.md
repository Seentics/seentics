<p align="center">
  <img src="logo.svg" alt="Seentics" width="80" />
</p>

<h1 align="center">Seentics</h1>

<p align="center">
  Open-source, privacy-first web analytics platform — real-time dashboards,
  session replays, heatmaps, funnels, behavioral automations, and embeddable UI components.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#embeddable-components">Components</a> ·
  <a href="#self-hosting">Self-Hosting</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="DEPLOYMENT.md">Deploy to Production</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--v3-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/ClickHouse-FFCC01?logo=clickhouse&logoColor=black" alt="ClickHouse" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
</p>

<br />

<p align="center">
  <img src="web/public/analytics-dashboard.png" alt="Seentics Dashboard" width="100%" />
</p>

---

## What is Seentics?

Seentics is a self-hosted web analytics platform that helps you understand your visitors and improve conversions. Track pageviews, custom events, and user behavior with heatmaps, session replays, and funnels — all without cookies, fingerprinting, or sending data to third parties.

You own your data. Deploy in minutes with Docker.

---

## Features

### Web Analytics

**Overview** — single-page dashboard: summary cards, traffic chart, top pages, traffic sources, geography, devices, and browsers. Drill into any section via modal — no separate pages needed. Filter by date range, compare any two periods.

**Realtime** — live visitor count, currently active pages, and a live event feed with device and country.

**Goals** — page visit goals, custom event goals, and CSS selector click goals. See conversion rates and completion trends.

**Funnels** — multi-step conversion funnels. Visualize drop-off at each step and see your overall conversion rate.

**Events** — custom event tracking. View occurrence counts, unique users, and drill into property breakdowns per event.

**Annotations** — mark deploys, campaigns, and incidents directly on your traffic charts.

**Alerts** — threshold and anomaly alerts delivered via email or webhook.

**Scheduled Reports** — automated PDF/email digests on any schedule.

### Behavior Analytics

**Heatmaps** — click and scroll overlays for any page. Supports desktop, tablet, and mobile viewports. Live mode shows clicks as they happen.

**Session Replays** — record full user sessions with automatic PII masking. Stored in S3-compatible storage. Searchable by page, duration, country, and device.

**Path Analysis** — visualize user flows between pages. See where users come from and where they go next.

**Behavioral Automations** — trigger popups, banners, webhooks, or custom JavaScript based on exit intent, scroll depth, time on page, and more — without code deploys.

### Developer Tools

**Tracking Script** — one line of JS. Tracks pageviews, custom events, and goal completions automatically.

**API Keys** — agency-level API keys for server-to-server data access without JWT expiry.

**Webhooks** — push analytics events to any endpoint on configurable triggers.

**`@seentics/components`** — embeddable React components for analytics. Drop into any app with an API key.

**OpenAPI Reference** — full API explorer built into the dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Go 1.24 (Gin) |
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Analytics DB | ClickHouse |
| Metadata DB | PostgreSQL 15 |
| Event Streaming | NATS |
| Object Storage | S3-compatible (MinIO for local dev) |
| Cache & Rate Limiting | Redis 7 |

---

## Quick Start

Requirements: [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).

```bash
git clone https://github.com/Seentics/seentics.git
cd seentics

docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000). The API is at [http://localhost:3002](http://localhost:3002).

---

## Add the Tracking Script

After creating a site in the dashboard, add to your `<head>`:

```html
<script
  async
  src="http://localhost:3002/trackers/seentics.js"
  data-site-id="YOUR_SITE_ID"
></script>
```

Replace `localhost:3002` with your server URL in production.

### Track Custom Events

```javascript
// Basic
seentics.track('signup_click')

// With properties
seentics.track('purchase', { value: 49.99, plan: 'pro' })
```

### Goal Tracking

Create goals in **Settings → Goals**:

- **Page visit** — fires when a visitor hits a URL path (e.g. `/thank-you`)
- **Custom event** — fires when your code calls `seentics.track('event_name')`
- **CSS selector** — auto-fires when a visitor clicks a matching element (e.g. `#signup-btn`)

---

## Embeddable Components

Drop any chart or view into your own React app.

```bash
npm install @seentics/components
```

```tsx
import {
  SeenticsProvider,
  AnalyticsSummary,
  TrafficChart,
  FunnelChart,
} from '@seentics/components'

<SeenticsProvider apiKey="sk_age_..." baseUrl="https://api.yourdomain.com">
  {/* In a customer portal, admin panel, or your own product */}
  <AnalyticsSummary siteId="site_abc" dateRange="last_7_days" />
  <TrafficChart siteId="site_abc" metric="pageviews" groupBy="day" />
  <FunnelChart siteId="site_abc" funnelId="funnel_xyz" />
</SeenticsProvider>
```

Styled with CSS variables — integrates with any design system.

---

## Project Structure

```
seentics/
├── core/                        # Go backend API
│   ├── cmd/api/main.go          # Entry point
│   ├── internal/
│   │   ├── modules/
│   │   │   ├── analytics/       # Events, pageviews, goals, realtime
│   │   │   ├── websites/        # Site management, members
│   │   │   ├── funnels/         # Funnel steps + conversion tracking
│   │   │   ├── heatmaps/        # Click + scroll recording + query
│   │   │   ├── replays/         # Session recording + playback
│   │   │   ├── workflows/       # Behavioral automations
│   │   │   └── tracker/         # seentics.js serving
│   │   └── shared/
│   │       ├── database/        # Postgres + ClickHouse connections
│   │       ├── config/          # Env config + feature flags
│   │       ├── middleware/      # Auth, CORS, logging, rate limit
│   │       └── migrations/      # Postgres + ClickHouse schema
│   └── data/trackers/           # seentics.js tracking scripts
│
├── web/                         # Next.js 14 frontend
│   └── src/
│       ├── app/
│       │   └── websites/[websiteId]/
│       │       ├── page.tsx              # Analytics overview
│       │       ├── realtime/             # Live dashboard
│       │       ├── goals/                # Goals page
│       │       ├── funnels/              # Funnels page
│       │       ├── events/               # Events page
│       │       ├── heatmaps/             # Heatmaps
│       │       ├── replays/              # Session replays
│       │       ├── paths/                # Path analysis
│       │       ├── automations/          # Behavioral automations
│       │       ├── api-keys/             # API key management
│       │       ├── ui-blocks/            # Embeddable components
│       │       ├── docs/                 # API reference
│       │       └── settings/             # General, team, integrations, alerts
│       ├── components/                   # UI components per section
│       ├── lib/                          # API clients (one file per feature)
│       ├── hooks/                        # Custom React hooks
│       └── stores/                       # Zustand global state
│
├── packages/                    # Embeddable UI packages (MIT licensed)
│   └── components/              # @seentics/components — React components
│
├── docker-compose.yml           # Local dev stack
└── scripts/                     # Deployment utilities
```

---

## Self-Hosting

### Local Development

```bash
docker compose up -d --build
```

Starts PostgreSQL, ClickHouse, NATS, MinIO, Redis, and both the backend and frontend with hot reloading.

### Production

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions (AWS EC2 or any Linux server).

```bash
git clone https://github.com/Seentics/seentics.git
cd seentics
cp core/.env.example core/.env
./scripts/deploy.sh
```

### Key Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | See `.env.example` |
| `JWT_SECRET` | Auth token signing key | Required |
| `CLICKHOUSE_HOST` | ClickHouse host | `localhost` |
| `CLICKHOUSE_DB` | ClickHouse database | `seentics` |
| `NATS_URL` | NATS server URL | `nats://localhost:4222` |
| `S3_ENDPOINT` | S3/MinIO endpoint for replays | `http://minio:9000` |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins | `http://localhost:3000` |

Full list: [`core/.env.example`](core/.env.example)

---

## Architecture

```
Browser ──→ Next.js Frontend (:3000)
                  │
            Go Backend API (:3002)
                  │
    ┌─────────────┼──────────────┬──────────┐
    │             │              │          │
ClickHouse    PostgreSQL       NATS       Redis
(analytics    (metadata,    (event      (cache,
 data)         users,        streams)    rate limit)
               sites)
                  │
                MinIO
          (replays + assets)
```

Events are published to **NATS** and consumed by background workers that batch-write to **ClickHouse**. Redis handles caching and rate limiting. Session replays are stored in S3-compatible storage.

---

## Contributing

We welcome all contributions — bug reports, feature requests, docs, and code.

1. Fork the repo
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup.

---

## License

Seentics is licensed under [AGPL v3.0](LICENSE). You can self-host freely. Modifications must be open-sourced under the same license.

The `@seentics/components` package is MIT licensed.

---

<p align="center">
  Built by the <a href="https://github.com/Seentics">Seentics</a> team
</p>
