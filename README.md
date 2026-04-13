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
  <img src="https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white" alt="Bun" />
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
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

- **Analytics** — Dashboard, realtime, goals, funnels, events, comparisons, annotations  
- **Operations** — Alerts, scheduled reports  
- **Behavior** — Heatmaps, session replays, path analysis, on-site automations  
- **Developers** — Tracking script, per-website API keys, webhooks, `@seentics/components`, in-dashboard API docs  

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Bun, Hono, Drizzle ORM (TypeScript) |
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui |
| Primary DB | PostgreSQL 15 (app data + analytics events in this OSS stack) |
| Object Storage | S3-compatible (MinIO in Docker Compose for local dev) |

---

## Quick Start

Requirements: [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).

```bash
git clone https://github.com/Seentics/seentics.git
cd seentics

docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000). The API is served by **`core`** at [http://localhost:8080/api/v1](http://localhost:8080/api/v1) (see `docker-compose.yml`).

---

## Add the Tracking Script

After creating a site in the dashboard, add to your `<head>`:

```html
<script
  defer
  src="http://localhost:3000/trackers/seentics.js"
  data-website-id="YOUR_WEBSITE_ID"
></script>
```

Use the same **public** URL your visitors load (dashboard on `:3000` in Docker; in production, your web/edge URL). The ID is the website UUID from the Seentics dashboard.

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

<SeenticsProvider apiKey="YOUR_API_KEY" baseUrl="https://api.yourdomain.com">
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
├── core/                        # Bun + Hono + Drizzle — single OSS API
├── web/                         # Next.js app + dashboard UI
│   ├── trackers/                # `seentics.js` source (served under `/trackers/…`)
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
└── docker-compose.yml           # Local dev stack
```

---

## Self-Hosting

### Local Development

```bash
docker compose up -d --build
```

Starts PostgreSQL, MinIO, the Bun API (`core`), and the Next.js app (with dev hot reload on the pinned Compose file).

### Production

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting on a VPS or cloud instance. Configure secrets and `DATABASE_URL` for **`core`**, then run the stack with Docker (or your orchestrator) behind HTTPS.

### Key Environment Variables

Use [`.env.example`](.env.example) where present and [`docker-compose.yml`](docker-compose.yml) as the source of truth for ports and wired services.

| Variable | Role |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | Session / API auth |
| `GLOBAL_API_KEY` | Service-to-service / internal routes |
| `S3_*` / `S3_ENDPOINT` | Replay & heatmap object storage |
| `CORS_ALLOWED_ORIGINS` | Browser origins allowed to call the API |

---

## Architecture

```
Browser --> Next.js (:3000) -----> Bun API (:8080) -----> PostgreSQL
                               |                              |
                               +-----------------------------> MinIO
                                                    (replays / heatmaps; S3-compatible)
```

The tracker and dashboard call **`core`** (`/api/v1/...`). Analytics events are stored in **PostgreSQL** in this OSS stack; replays and heatmaps use **S3-compatible** storage (e.g. MinIO in Docker).

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
