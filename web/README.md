# Seentics Analytics Frontend

The modern user interface for the Seentics web analytics platform. Built with Next.js, React, and TypeScript.

## Features

- **Web Analytics**: Overview dashboard with traffic charts, top pages, sources, geography, devices, and browsers. Compare any two date ranges.
- **Realtime**: Live visitor count, active pages, and event feed with device and country context.
- **Goals & Funnels**: Track page visit goals, custom event goals, and CSS selector click goals. Build multi-step conversion funnels and visualize drop-off.
- **Events**: Custom event tracking with occurrence counts, unique users, and property breakdowns.
- **Behavior Analytics**: Heatmaps (click and scroll overlays), session replays with PII masking, path analysis, and behavioral automations.
- **Developer Tools**: API key management, embeddable UI Blocks, and an integrated API reference.

## Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Visualization**: [Recharts](https://recharts.org/)
- **State**: [Zustand](https://zustand-demo.pmnd.rs/)

## Installation

### 1. Configure Environment
```bash
cp .env.example .env.local
```

### 2. Install & Start
```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Environment Configuration

```env
# Point this to your Analytics Backend
NEXT_PUBLIC_API_URL=http://localhost:3002

# Authentication
NEXTAUTH_SECRET=your-secure-secret-here
NEXTAUTH_URL=http://localhost:3000
```

## Development Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run lint`: Run code linting
- `npm run typecheck`: Verify TypeScript types

---

Built with care for the open source community.
