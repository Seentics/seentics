# Contributing to Seentics

Thank you for your interest in contributing. This document covers the open-source app layout in this repo.

## Getting started

### Prerequisites

- **Bun** (recommended) or **Node.js** 18+ for `npm run check` in `core`
- **Docker** and Docker Compose
- **Git**

### Development setup

1. Fork the repository and clone your fork.
2. Install dependencies:
   ```bash
   cd core && bun install # or: npm install
   cd ../web && npm install
   ```
3. Environment: see **`.env.example`** in this directory and **`docker-compose.yml`** for local URLs and ports.
4. Start the stack: `docker compose up -d --build` (from the `seentics/` directory).

## How to contribute

- Use GitHub Issues for bug reports with clear reproduction steps.
- Use branches and PRs with focused changes; match existing code style in `core/` and `web/`.

## Code style

- **Core (`core/`)**: TypeScript, Hono routes, Drizzle for SQL; run `npm run check` (or `bunx tsc --noEmit`) before pushing.
- **Frontend (`web/`)**: Next.js, Tailwind, existing component patterns.

## Project structure

```
seentics/
├── core/             # Bun + Hono + Drizzle — OSS API
├── web/              # Next.js dashboard
└── docker-compose.yml
```

Thank you for helping improve Seentics.
