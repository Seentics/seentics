<p align="center">
  <img src="logo.svg" alt="Seentics" width="100" />
</p>

<h1 align="center">Seentics</h1>

<p align="center">
  <strong>The open-source, privacy-first analytics platform that turns data into action.</strong>
  <br />
  Real-time insights, Visual Heatmaps, Session Replays, Advanced Funnels, and Behavioral Automations.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#tech-stack">Tech Stack</a> &middot;
  <a href="DEPLOYMENT.md">Deployment</a> &middot;
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL%20v3-blue.svg" alt="License" /></a>
  <a href="https://golang.org"><img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white" alt="Go" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" /></a>
  <a href="https://www.docker.com"><img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" /></a>
</p>

<p align="center">
  <img src="web/public/analytics-dashboard.png" alt="Seentics Dashboard" width="100%" />
</p>

---

## 🚀 Why Seentics?

Most analytics tools tell you *what* happened, but they don't help you understand *why* or let you *act* on it. Seentics brings the power of enterprise behavior analysis to everyone, without sacrificing privacy or performance.

- **Privacy First** — No cookies, no fingerprints, no PII. GDPR/PECR compliant by design.
- **Visual Evidence** — Don't just look at charts; see exactly how users interact with Heatmaps and Replays.
- **Actionable** — Use our Visual Automation Builder to trigger on-site actions based on real-time behavior.
- **Self-Hosted** — You own your data. Deploy in minutes on your own infrastructure.
- **Built for Scale** — Powered by ClickHouse and Go for high-throughput event processing.

## ✨ Features

### 📊 Real-time Analytics
A snapshot of your site's health. Monitor live visitors, page views, session duration, and bounce rates across custom date ranges. Breakdown by source, device, browser, and geography.

### 🔥 Visual Heatmaps
Stop guessing where users click. Our high-performance heatmap engine generates click maps and scroll maps without slowing down your site. Supporting multiple viewports (Desktop/Tablet/Mobile) and live page switching.

### 📼 Session Replays
Watch exactly how users navigate your site. Understand friction points, identify bugs, and improve UX with full session reconstructions. Stored efficiently in S3-compatible storage with automatic PII masking.

### 🚀 Advanced Funnels
Visualize the customer journey. Create multi-step funnels to see exactly where users are dropping off in your signup flow or checkout process.

### 🤖 Behavioral Automations
Turn visitors into customers. Use our low-code visual builder to trigger:
- **Popups & Banners** based on exit intent or scroll depth.
- **Custom Webhooks** to sync data with your CRMs or messaging apps.
- **JavaScript Injection** for personalized site modifications.

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Go 1.24 (Gin Gonic) |
| **Frontend** | Next.js 14, Tailwind CSS, Radix UI |
| **Analytics DB** | ClickHouse (Primary) |
| **Metadata DB** | PostgreSQL 15 |
| **Streaming** | NATS JetStream (Asynchronous event processing) |
| **Caching** | [CacheGrid](https://github.com/skshohagmiah/cachegrid) (Embedded Go Cache) |
| **Storage** | S3-Compatible (MinIO for local development) |

---

## ⚡ Quick Start

### 1. Requirements
Ensure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

### 2. Launch
```bash
# Clone the repository
git clone https://github.com/Seentics/seentics.git
cd seentics

# Copy environment variables
cp core/.env.example core/.env

# Start the full stack
docker compose up -d --build
```

### 3. Access
- **Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API**: [http://localhost:3002](http://localhost:3002)

---

## 🏗 Architecture

```text
[Browser] --> [Next.js Frontend :3000]
                    |
              [Go Backend :3002] (NATS + ClickHouse + Postgres)
                    |
     +--------------+-------------+-------------+
     |              |             |             |
 ClickHouse      Postgres       MinIO       CacheGrid
 (Events)       (Metadata)    (Replays)      (Caching)
```

## 🤝 Contributing

We love contributions! Whether it's a bug report, a new feature, or a documentation improvement, feel free to open an issue or submit a pull request.

Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## 📄 License

Seentics is licensed under the **AGPL v3.0**. See the [LICENSE](LICENSE) file for more information. 

---

<p align="center">
  Built with ❤️ by the <a href="https://github.com/Seentics">Seentics Team</a>
</p>
