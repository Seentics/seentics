# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial open source release
- Comprehensive documentation
- Issue templates and contribution guidelines
- Code of conduct

### Changed
- Updated README for open source community
- Removed sensitive environment file references
- Added environment setup documentation

## [1.0.0] - 2026-01-15

### Added
- **Consolidated Architecture**
  - Unified API Gateway with internal User and Website management
  - High-performance Analytics Service focus purely on event tracking
  - PostgreSQL-backed user and website storage in the Gateway
  - Core analytics features: page views, sessions, custom events
  - Modern, premium dashboard UI and brand identity
  - Lemon Squeezy integration for cloud-enabled billing

### Removed
- **Funnel Features**: Removed all funnel-related code and UI to focus on core metrics
- **Visual Workflow Builder**: Removed workflow service and UI
- **Legacy Microservices**: Removed separate `user-service` and `workflows-service`
- **MongoDB Dependency**: Migrated all relational data to PostgreSQL

## [0.1.0] - 2024-12-19

### Added
- **Core Platform**
  - Visual workflow builder with drag-and-drop interface
  - Real-time analytics tracking engine
  - User authentication and management system
  - Multi-website support

- **Analytics Features**
  - Pageview and session tracking
  - User behavior analytics
  - Real-time dashboard
  - Custom event tracking

- **Workflow Automation**
  - Trigger-based workflow execution
  - Multiple action types (modals, emails, webhooks)
  - Conditional logic and branching
  - A/B testing support

- **Technical Infrastructure**
  - Microservices architecture
  - Go-based analytics service
  - Node.js user and workflow services
  - Next.js frontend application
  - Docker containerization
  - TimescaleDB for time-series data
  - MongoDB for user and workflow data
  - Redis for caching and queues

### Security
- JWT-based authentication
- OAuth integration (Google, GitHub)
- Rate limiting and CORS protection
- Secure webhook handling

### Documentation
- System architecture overview
- API documentation
- Feature guides
- Setup instructions

---

## Version History

- **0.1.0**: Initial release with core functionality
- **Unreleased**: Open source preparation and community guidelines

## Contributing to Changelog

When adding new features or fixing bugs, please update this changelog by:

1. Adding a new entry under the appropriate version
2. Using the same format as existing entries
3. Including a brief description of the change
4. Categorizing changes as Added, Changed, Deprecated, Removed, Fixed, or Security

## Release Process

1. **Development**: Features and fixes are developed in feature branches
2. **Testing**: All changes are tested locally and in staging
3. **Review**: Code is reviewed and approved through pull requests
4. **Release**: Changes are merged to main and tagged with version number
5. **Documentation**: Changelog is updated and release notes are published
