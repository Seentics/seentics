# Seentics - Open Source Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![MVP Ready](https://img.shields.io/badge/Status-MVP%20Ready-brightgreen.svg)](https://github.com/seentics/seentics)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-blue.svg)](https://docs.docker.com/compose/)

**🚀 Production-ready open-source platform** for real-time analytics and intelligent user behavior tracking. Built with high-performance Go and PostgreSQL for maximum scalability.

## 🌟 **Open Source First**

Seentics is designed as a **fully-featured open source platform** with unlimited usage:

- ✅ **Unlimited everything** - websites, events
- ✅ **No usage restrictions** or billing limitations  
- ✅ **Complete self-hosted control** over your data
- ✅ **All core features** - analytics, tracking, privacy
- ✅ **Production-ready** for any scale of deployment

> **Note**: We also offer a hosted cloud service at [seentics.com](https://seentics.com) for those who prefer a managed solution. The codebase includes cloud mode features, but these are reserved for our official hosted service only.

## ✨ **What Makes Seentics Special**

- **📊 Real-Time Analytics**: High-performance event processing (10,000+ events/sec) with PostgreSQL
- **🏗️ Modern Architecture**: Lightweight Go services optimized for performance
- **🛡️ Privacy-First**: Built-in GDPR compliance and data privacy controls
- **🚀 Self-Hosted**: Complete control over your data and infrastructure

## 🌟 **Core Features**


### 📊 **High-Performance Analytics**
- **Real-Time Processing**: 10,000+ events/second with PostgreSQL optimization
- **Comprehensive Tracking**: Page views, custom events, user sessions
- **Advanced Dashboards**: Interactive charts, real-time metrics, custom date ranges
- **Privacy Compliant**: GDPR-ready with data retention controls and user consent management

### 🛡️ **Enterprise-Ready Security**
- **JWT Authentication**: Secure token-based auth with refresh token support
- **API Gateway**: Centralized routing, user management, rate limiting, and request validation
- **Data Privacy**: Built-in GDPR compliance tools and data export capabilities

<div align="center">

### 📊 **System Architecture Diagram**

<img src="./docs/simplified_architecture_diagram.svg" alt="Seentics System Architecture" width="100%" style="max-width: 1000px;">

</div>

### **Service Breakdown**

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| **API Gateway** | Go/Gin | 8080 | Request routing, auth, user management, rate limiting |
| **Analytics Service** | Go | 3002 | Event tracking, analytics, reporting |
| **Automation Service** | Go | - | Event-driven workflows (Consumes Kafka events) |
| **Frontend** | Next.js/React | 3000 | User interface and dashboard |

### **Data Storage & Messaging**

| Component | Purpose | Data Type |
|----------|---------|-----------|
| **PostgreSQL** | User accounts, websites, analytics data | Relational / Time-series |
| **Redis** | Caching, rate limiting, sessions | In-memory storage |
| **Kafka** | Event-driven backbone, analytics buffer | Distributed Log / Stream |

## 🚀 **Quick Start**

### **Prerequisites**
- **Node.js** 18+ 
- **Go** 1.21+
- **Docker** & Docker Compose
- **Git**

### **1. Clone the Repository**
```bash
git clone https://github.com/skshohagmiah/Seentics
cd seentics
```

### **2. Start Infrastructure Services**
```bash
# Start databases and Redis
docker compose up -d postgres gateway-db redis

# Wait for services to be ready (check with docker compose ps)
```

### **3. Configure Environment Variables**
```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# The platform runs in open source mode by default
# No additional configuration needed for full functionality

# Edit .env files with your configuration
# See Configuration section below for required variables
```

### **4. Start All Services**
```bash
# Option 1: Start all services with Docker Compose (Recommended)
docker compose up -d

# Option 2: Start services individually
cd services/gateway && go run .
cd services/analytics && go run .
```

### **5. Start Frontend**
```bash
cd frontend
npm install
npm run dev
```

### **6. Access the Application**
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Gateway**: [http://localhost:8080](http://localhost:8080)
- **Analytics Service**: [http://localhost:3002](http://localhost:3002)

### **7. Start Monitoring**
1. **Sign up** at [http://localhost:3000](http://localhost:3000)
2. **Add a website** to start tracking
3. **Install tracking code** on your website
4. **Monitor analytics** in real-time

## ⚙️ **Configuration**

### **Environment Variables**

#### **API Gateway** (`.env`)
```bash
PORT=8080
DATABASE_URL=postgres://seentics:seentics_gateway_pass@gateway-db:5432/seentics_gateway
ANALYTICS_SERVICE_URL=http://analytics-service:3002
JWT_SECRET=your-secure-jwt-secret
```

#### **Analytics Service** (`.env`)
```bash
PORT=3002
DATABASE_URL=postgres://seentics:seentics_postgres_pass@postgres:5432/seentics_analytics
USER_SERVICE_URL=http://api-gateway:8080
LOG_LEVEL=info
```

### **Database Setup**
```bash
# PostgreSQL (Analytics)
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_DB=seentics_analytics \
  -e POSTGRES_USER=seentics \
  -e POSTGRES_PASSWORD=seentics_postgres_pass \
  postgres:15-alpine

# PostgreSQL (Gateway)
docker run -d --name gateway-db -p 5433:5432 \
  -e POSTGRES_DB=seentics_gateway \
  -e POSTGRES_USER=seentics \
  -e POSTGRES_PASSWORD=seentics_gateway_pass \
  postgres:15-alpine

# Redis (Caching & Queues)
docker run -d --name redis -p 6379:6379 redis:latest
```

## 📚 **API Overview**

### **Public Endpoints** (No Authentication Required)
```
# Analytics Tracking
POST /api/v1/analytics/event                  - Track single event
POST /api/v1/analytics/event/batch            - Batch event tracking

```

### **Authenticated Endpoints** (JWT Required)
```
# Authentication
POST /api/v1/user/auth/login                  - User login
POST /api/v1/user/auth/register               - User registration
GET  /api/v1/user/profile                     - Get current user profile

# Website Management
GET  /api/v1/user/websites                    - Get user websites
POST /api/v1/user/websites                    - Create website
GET  /api/v1/user/websites/:id                - Get single website
PUT  /api/v1/user/websites/:id                - Update website
DELETE /api/v1/user/websites/:id              - Delete website

# Analytics Dashboard
GET  /api/v1/analytics/dashboard/:websiteId   - Dashboard overview
GET  /api/v1/analytics/top-pages/:websiteId   - Top pages report
GET  /api/v1/analytics/hourly-stats/:websiteId - Hourly statistics

```

## 🔧 **Development Workflow**

### **Local Development**
1. **Start Infrastructure**: `docker compose up -d`
2. **Start Services**: Each service can be run individually for development
3. **Frontend Development**: Next.js with hot reloading
4. **API Testing**: Use Postman or curl for API testing

### **Testing**
```bash
# Run all tests
npm run test

# Run specific service tests
cd services/gateway && go test ./...
cd services/analytics && go test ./...

# Frontend tests
cd frontend && npm test
```

### **Code Quality**
- **ESLint** for JavaScript/TypeScript
- **Go fmt** and **golangci-lint** for Go
- **Prettier** for code formatting
- **Husky** for pre-commit hooks

## 📊 **Performance & Monitoring**

### **Health Checks**
- **Service Health**: `/health` endpoint on each service
- **Readiness Checks**: `/ready` endpoint for deployment readiness
- **Metrics**: Prometheus metrics on `/metrics` endpoints

### **Performance Metrics**
- **Event Processing**: 10,000+ events/second with PostgreSQL optimization
- **API Response Time**: <100ms for cached responses via Redis
- **Dashboard Load Time**: <2 seconds for 30-day analytics with 1M+ events
- **Real-time Updates**: <5 second refresh intervals
- **Concurrent Users**: Supports 1000+ simultaneous dashboard users

### **Monitoring Tools**
- **Prometheus**: Metrics collection
- **Grafana**: Dashboard visualization
- **Jaeger**: Distributed tracing
- **ELK Stack**: Log aggregation

## 🏢 **Cloud Mode (Internal Use Only)**

> **⚠️ Important**: The cloud mode features are reserved for our official hosted service at [seentics.com](https://seentics.com). These features are included in the codebase for transparency but are not intended for third-party commercial use.

For developers interested in the implementation, cloud mode can be enabled with:

```bash
# Backend (.env)
CLOUD_FEATURES_ENABLED=true

# Frontend (.env.local)  
NEXT_PUBLIC_CLOUD_FEATURES_ENABLED=true

# Additional billing configuration (requires Stripe setup)
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

This adds subscription tiers, usage limits, billing pages, and team management features for our managed service.

## 🚀 **Deployment**

### **Production Deployment**
```bash
# Build Docker images
docker compose -f docker-compose.prod.yml build

# Deploy to production
docker compose -f docker-compose.prod.yml up -d

# Scale services
docker compose -f docker-compose.prod.yml up -d --scale analytics-service=3
```

### **Environment-Specific Configs**
- **Development**: `docker-compose.yml`
- **Staging**: `docker-compose.staging.yml`
- **Production**: `docker-compose.prod.yml`

### **Kubernetes Deployment**
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n seentics
```

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### **Ways to Contribute**
- 🐛 **Report Bugs**: Create detailed bug reports
- 💡 **Suggest Features**: Propose new functionality
- 📝 **Improve Docs**: Enhance documentation
- 🔧 **Code Changes**: Submit pull requests
- 🧪 **Write Tests**: Add test coverage
- 🌍 **Localization**: Help with translations

### **Development Setup**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📚 **Documentation**

- [**Analytics Service**](./services/analytics/README.md) - Analytics service documentation
- [**API Gateway**](./services/gateway/README.md) - Unified API and User management
- [**Frontend**](./frontend/README.md) - Dashboard and client application documentation

## 🆘 **Support & Community**

- 📖 [**Issues**](https://github.com/seentics/seentics/issues) - Bug reports and feature requests
- 💬 [**Discussions**](https://github.com/seentics/seentics/discussions) - Community discussions
- 📧 [**Email Support**](mailto:support@seentics.com) - Direct support
- 🐦 [**Twitter**](https://twitter.com/seentics) - Latest updates

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## ⭐ **Star History**

If you find this project helpful, please give it a star! ⭐

## 🎯 **Use Cases**

### **SaaS & Tech**
- **User Onboarding**: Identify where users drop off in the registration process
- **Product Usage**: Monitor feature engagement to inform product development
- **Churn Prevention**: Identify inactive users based on session frequency

### **Content & Media**
- **Content Performance**: Monitor which articles drive the most engagement
- **User Interests**: Segment visitors based on the content they consume
- **Engagement Patterns**: Analyze scroll depth and reading time

## 🌍 **Community & Support**

- **🐛 GitHub Issues**: Bug reports and feature requests
- **💬 Discussions**: Community Q&A and feature discussions
- **🔧 Contributing**: Open source contributions welcome
- **📧 Support**: Community-driven support and assistance

## 🚀 **Roadmap**

### **Current (MVP)**
- ✅ High-performance real-time analytics
- ✅ Intelligent event tracking
- ✅ Privacy-first data collection
- ✅ GDPR compliance tools

### **Next Release**
- 🔄 Advanced A/B testing
- 🔄 Email integration (SendGrid, Mailgun)
- 🔄 Advanced segmentation
- 🔄 Mobile app analytics

### **Future**
- 📱 Mobile SDK
- 🤖 AI-powered insights
- 🔗 Advanced integrations
- 📊 Custom reporting

---

**Built with ❤️ by the open source community**

*Seentics - Making websites intelligent, one event at a time.*
