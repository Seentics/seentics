# Seentics Frontend

The frontend application for [Seentics](https://github.com/seentics/seentics) - an open-source real-time analytics platform built with Next.js, React, and TypeScript.

## 🚀 Features

- **📊 Real-time Analytics Dashboard**: Live insights into user behavior, sessions, and events
- **🎨 Modern UI/UX**: Built with Tailwind CSS and ShadCN UI components
- **📱 Responsive Design**: Mobile-first approach with excellent cross-device support
- **🌙 Theme Support**: Dark/light mode with system preference detection
- **⚡ Performance**: Optimized with Next.js 14 features and React best practices

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/) for type safety
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with custom design system
- **Components**: [ShadCN UI](https://ui.shadcn.com/) component library
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) for global state
- **Data Fetching**: [TanStack Query](https://tanstack.com/query) for server state
- **Forms**: [React Hook Form](https://react-hook-form.com/) with Zod validation
- **Data Visualization**: [Recharts](https://recharts.org/) for beautiful, responsive charts

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Access to Seentics backend services

### Quick Start
```bash
# Clone the repository
git clone https://github.com/seentics/seentics.git
cd seentics/frontend

# Install dependencies
npm install

# Set up environment variables
cp env.example .env.local

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🔧 Environment Configuration

Create a `.env.local` file with the following variables:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080
API_GATEWAY_URL=http://localhost:8080

# Authentication
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication routes
│   │   ├── admin/              # Admin panel
│   │   ├── websites/           # Website management
│   ├── components/             # Reusable React components
│   │   ├── ui/                 # Base UI components (ShadCN)
│   │   ├── analytics/          # Analytics-specific components
│   │   └── landing/            # Landing page components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility functions and API clients
│   ├── stores/                 # Zustand state stores
│   └── types/                  # TypeScript type definitions
├── public/                     # Static assets
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## 🎨 Component Architecture

### UI Components
- **Base Components**: Built on ShadCN UI primitives
- **Layout Components**: Shell, Sidebar, Header, Footer
- **Form Components**: Inputs, selects, checkboxes with validation
- **Data Display**: Tables, charts, cards, and modals

### Feature Components
- **Analytics**: Charts, metrics, and data visualization
- **Authentication**: Login forms, OAuth providers, and user management
- **Settings**: Configuration panels and preference management

## 🔌 API Integration

The frontend communicates with backend services through:

- **Analytics Service**: Event tracking and analytics data
- **API Gateway**: Unified endpoint for user management, websites, and analytics

### API Client Setup
```typescript
// Example API call
import { api } from '@/lib/api'

const stats = await api.get('/analytics/dashboard/123')
```

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
```

### Code Quality
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting (configured in VS Code)
- **TypeScript**: Strict type checking enabled
- **Husky**: Git hooks for pre-commit checks

### Testing
Currently, the project uses placeholder test scripts. To add testing:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

## 🚀 Deployment

### Build Process
```bash
npm run build
```

The application builds to the `.next` directory with standalone output enabled.

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Frontend-Specific Guidelines
- Follow React and Next.js best practices
- Use TypeScript for all new code
- Follow the established component patterns
- Ensure responsive design for all new components
- Add proper TypeScript types for all functions and components

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [ShadCN UI Components](https://ui.shadcn.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🐛 Troubleshooting

### Common Issues

**Build Errors**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**TypeScript Errors**
```bash
# Check types
npm run typecheck
```

**Dependency Issues**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Getting Help
- Check existing [GitHub Issues](https://github.com/seentics/seentics/issues)
- Join our [Discussions](https://github.com/seentics/seentics/discussions)
- Review the [main project README](../../README.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

**Built with ❤️ by the Seentics community**
