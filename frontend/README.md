# Seentics Analytics Frontend

The modern user interface for the Seentics Open Source Analytics platform. Built with Next.js, React, and TypeScript.

## 🚀 Features

- **📊 Real-time Dashboard**: Live insights into user behavior, sessions, and events.
- **🎨 Modern UI**: Responsive design with Dark/Light mode support.
- **⚡ Performance**: Optimized with Next.js App Router and TanStack Query.
- **🗺️ Geolocation**: Visual breakdown of visitor traffic by country and region.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Visualization**: [Recharts](https://recharts.org/)
- **State**: [Zustand](https://zustand-demo.pmnd.rs/)

## 📦 Installation

### 1. Configure Environment
```bash
# Copy the environment template
cp .env.example .env.local
```

### 2. Install & Start
```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the dashboard.

## 🔧 Environment Configuration

The following variables are required in `.env.local`:

```env
# Point this to your Analytics Backend
NEXT_PUBLIC_API_URL=http://localhost:3002

# Authentication
NEXTAUTH_SECRET=your-secure-secret-here
NEXTAUTH_URL=http://localhost:3000
```

## 🧪 Development Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run lint`: Run code linting
- `npm run typecheck`: Verify TypeScript types

---

Built with ❤️ for the Open Source community.
