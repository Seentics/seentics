# Seentics 🚀

**Complete Open Source Websites Analytics and Automation Software.**

Seentics is a production-ready analytics platform built for speed, privacy, and scale. It combines deep behavioral insights with a powerful automation engine, giving you absolute data ownership.

[![License](https://img.shields.io/badge/license-AGPL%20v3-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-Compatible-2496ED?logo=docker)](https://www.docker.com)

---

## 🌟 Why Seentics?

- **Data Ownership**: 100% open-source. Host it yourself and keep your data private.
- **Privacy Native**: GDPR/CCPA compliant out of the box. No cookie banners needed for basic tracking.
- **Scale-Ready**: Hybrid storage with PostgreSQL for metadata and ClickHouse for massive event analytics.
- **Real-Time**: Sub-second event ingestion powered by Kafka and Redis.
- **Actions, Not Just Data**: Automate UI changes and emails based on real-time visitor behavior.

---

## ✨ Core Features

- **📊 Real-Time Analytics**: Live visitor streams, page views, and custom event tracking.
- **🔥 Heatmaps**: Visual mapping of user clicks, pointer movement, and scroll depth.
- **🎥 Session Replays**: High-fidelity session recordings with automatic masking for privacy.
- **📈 Funnel Analysis**: Multi-step conversion tracking to identify and fix drop-offs.
- **🤖 Behavioral Automation**: Logic-driven triggers for popups, banners, and interactions.

---

## 🛠️ Tech Stack

- **Backend**: Go 1.24+ (Gin, SQLx, Kafka-Go)
- **Frontend**: Next.js 14, Tailwind CSS, shadcn/ui
- **Analytics Store**: ClickHouse
- **Relational DB**: PostgreSQL 15+
- **Stream Engine**: Apache Kafka
- **Cache Layer**: Redis 7
- **Storage**: S3-Compatible (MinIO for local development)

---

## 🚀 Local Development

Get started in under 5 minutes:

### 1. Setup
```bash
git clone https://github.com/Seentics/seentics.git
cd seentics
cp core/.env.example core/.env
```

### 2. Launch
```bash
docker-compose up --build
```

### 3. Access
- **Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API**: [http://localhost:3002](http://localhost:3002)

---

## 🚢 Production

A dedicated production setup is available in the `deploy/` directory, featuring Nginx reverse proxying and automated SSL via Let's Encrypt.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full guide.

---

## 🤝 Community

- **GitHub**: [Seentics/seentics](https://github.com/Seentics/seentics)
- **Contribute**: Check out [CONTRIBUTING.md](CONTRIBUTING.md) to get started!

---

## 📄 License
Licensed under AGPL v3.0. See [LICENSE](LICENSE) file.

Built with ❤️ by the Seentics community.
