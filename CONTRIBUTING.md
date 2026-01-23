# Contributing to Seentics Analytics

Thank you for your interest in contributing to the Seentics Analytics engine! This document provides guidelines for contributors to the Open Source analytics stack.

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+
- **Go** 1.23+
- **Docker** & Docker Compose
- **Git**

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/skshohagmiah/seentics-analytics.git`
3. Install dependencies:
   ```bash
   # Analytics Backend
   cd backend && go mod tidy
   
   # Analytics Frontend
   cd ../frontend && npm install
   ```
4. Set up environment variables:
   - Create `.env` in `backend/` based on `.env.example`
   - Create `.env.local` in `frontend/` based on `frontend/.env.example`
5. Start infrastructure: `docker compose up -d` (Postgres, Redis, Kafka)

## 📝 How to Contribute

### 1. Reporting Issues
- Use GitHub Issues for bug reports.
- Provide clear reproduction steps and environment details.

### 2. Submitting Code Changes
1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes and add tests.
3. Ensure Go code is formatted: `go fmt ./...`
4. Commit with clear messages.
5. Open a Pull Request.

## 🎯 Development Guidelines

### Code Style
- **Backend (Go)**: Follow standard Go conventions and use `zerolog` for logging.
- **Frontend (Next.js)**: Use TailwindCSS (if enabled) and follow React best practices.

### Testing
- **Backend**: Run tests with `go test ./...`
- **Frontend**: Run tests with `npm test`

## 🔧 Project Structure

```
analytics/
├── backend/                 # Go Analytics Engine
├── frontend/                # Next.js Dashboard UI
├── docker-compose.yml       # Standalone OSS stack
└── README.md                # Project overview
```

---

Thank you for helping make Seentics better! 🚀
