# Seentics - Open Source Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**🚀 Production-ready open-source platform** for real-time analytics and intelligent user behavior tracking. Built with high-performance Go and PostgreSQL for maximum scalability.

## 🌟 **Open Source First**

Seentics is designed as a **fully-featured open source platform** with unlimited usage:

- ✅ **Unlimited everything** - websites, events
- ✅ **No usage restrictions** or billing limitations  
- ✅ **Complete self-hosted control** over your data
- ✅ **All core features** - analytics, tracking, privacy
- ✅ **Production-ready** for any scale of deployment

> **Note**: We also offer a hosted cloud service at [seentics.com](https://seentics.com). The codebase includes cloud mode features, which can be enabled via `CLOUD_ENABLED=true` for inter-service integration.

## ✨ **Core Features**

### 📊 **High-Performance Analytics**
- **Real-Time Processing**: 10,000+ events/second with PostgreSQL optimization.
- **Comprehensive Tracking**: Page views, custom events, user sessions.
- **Advanced Dashboards**: Interactive charts, real-time metrics, custom date ranges.
- **Privacy Compliant**: GDPR-ready with data retention controls and user consent management.

### 🛡️ **Security & Scalability**
- **Unified Authentication**: Uses JWT for standalone OSS deployments.
- **Rate Limiting**: Integrated Redis-based rate limiting.
- **Infrastructure**: Powered by PostgreSQL, Redis, and Kafka for high-volume ingestion.

### **Service Breakdown**

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| **Analytics Backend** | Go | 3002 | Event tracking, analytics, and reporting API |
| **Analytics Frontend**| Next.js | 3000 | User dashboard and management interface |

### **Recommended Infrastructure**

| Component | Purpose | Data Type |
|----------|---------|-----------|
| **PostgreSQL** | Primary storage for events and analytical data | Relational |
| **Redis** | Caching, rate limiting, and real-time session tracking | Key-Value |
| **Kafka** | High-performance event buffer for ingestion | Stream |

## 🚀 **Quick Start**

### **Prerequisites**
- **Docker** & Docker Compose
- **Node.js** 18+ (for local development)
- **Go** 1.23+ (for local development)

### **1. Clone the Repository**
```bash
git clone https://github.com/skshohagmiah/seentics-analytics.git
cd seentics-analytics
```

### **2. Configure Environment**
```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

### **3. Start with Docker Compose (Recommended)**
```bash
# Launch the entire OSS stack (Backend, Frontend, DB, Redis, Kafka)
docker compose up -d
```

### **4. Access the Platform**
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Health Check**: [http://localhost:3002/health](http://localhost:3002/health)

## ⚙️ **Configuration**

### **Backend Variables** (`.env`)
```bash
ENVIRONMENT=development
PORT=3002
DATABASE_URL=postgres://seentics:seentics_postgres_pass@postgres:5432/seentics_analytics
REDIS_URL=redis://:seentics_redis_pass@redis:6379
JWT_SECRET=your-secure-jwt-secret
CLOUD_ENABLED=false
```

## 📚 **API Overview**

### **Tracking Endpoints** (Public)
```
POST /api/v1/analytics/event                  - Track single event
POST /api/v1/analytics/event/batch            - Batch event tracking
```

### **Management Endpoints** (JWT Required)
```
GET  /api/v1/analytics/dashboard/:website_id   - Dashboard overview
GET  /api/v1/analytics/top-pages/:website_id   - Top pages report
GET  /api/v1/analytics/hourly-stats/:website_id - Hourly statistics
GET  /api/v1/analytics/geolocation-breakdown/:website_id - Geolocation data
```

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

**Built with ❤️ by the open source community**
