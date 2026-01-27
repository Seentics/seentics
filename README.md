# Seentics - Open Source Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**🚀 Production-ready open-source platform** for real-time analytics and intelligent user behavior tracking. Seentics provides the speed of Google Analytics with the privacy and control of a self-hosted solution. Built with high-performance Go, Kafka, and PostgreSQL.

## 🌟 **Why Seentics?**

Seentics is designed as a **fully-featured open source platform** that puts you in control:

- ✅ **Unlimited everything** - No caps on websites, events, or users.
- ✅ **Privacy by Design** - GDPR/CCPA compliant. You own 100% of your data.
- ✅ **No usage restrictions** - Forget monthly bills based on "hits" or "events".  
- ✅ **Real-Time Insight** - See what's happening on your site the second it happens.
- ✅ **Intelligent Automations** - The only open-source analytics with a built-in behavioral trigger engine.

> **Note**: While Seentics is open-source first, we also offer a managed cloud service at [seentics.com](https://seentics.com) for teams who want to skip the infrastructure management.

## ✨ **Core Features**

### 📊 **High-Performance Analytics**
- **Real-Time Data**: Sub-second latency for event processing.
- **Visitor Insights**: Detailed breakdown of browsers, OS, devices, and geolocation.
- **Custom Event Tracking**: Track clicks, form submissions, and unique user interactions.
- **Data Retention**: Granular control over how long your data is stored.

### 🤖 **Automations Engine (Powerful!)**
Seentics goes beyond just *seeing* data—it lets you *act* on it. 
- **Trigger Actions**: Show specific modals, banners, or trigger webhooks when users meet certain criteria.
- **Behavioral Filters**: Trigger based on time on site, scroll depth, or specific page visits.
- **Workflow Builder**: Visual editor to design user journeys and automated interactions.

### 📈 **Funnel & Path Analysis**
- **Conversion Funnels**: Identify where users drop off in your sign-up or checkout flows.
- **Entry & Exit Pages**: Understand exactly where your traffic starts and ends.
- **Page Flows**: Visualize the paths users take through your application.

### 🛡️ **Engineering & Infrastructure**
Built for massive scale, Seentics uses a modern distributed architecture:
- **Go Backend**: Memory-safe, high-concurrency event handling.
- **Kafka Pipeline**: Bulletproof event ingestion that handles traffic spikes with ease.
- **Redis Layer**: Lightning-fast rate limiting and real-time session management.
- **PostgreSQL**: Robust, relational storage with time-based partitioning for long-term data.

### **Service Breakdown**

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| **Backend** | Go 1.23+ | 3002 | API Gateway, Event Processing, & Management |
| **Frontend**| Next.js 14+ | 3000 | Beautiful Dashboard & Project Management |

### **Recommended Infrastructure**

| Component | Purpose | Data Type |
|----------|---------|-----------|
| **PostgreSQL** | Primary storage for structured analytics data | Relational |
| **Kafka** | High-throughput distributed event streaming | Stream |
| **Redis** | In-memory cache and session tracker | Key-Value |
| **Cassandra** (Optional) | Scalable storage for raw event logs | NoSQL |

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
