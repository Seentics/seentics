# Analytics Service

A high-performance analytics microservice built with Go, designed to handle real-time website analytics and user behavior analysis using PostgreSQL.

## Features

- **Real-time Analytics**: Track page views, user sessions, and custom events
- **Performance Optimized**: Uses PostgreSQL with native partitioning for time-series data optimization
- **Scalable Architecture**: Built with Go for high performance and low resource usage
- **RESTful API**: Clean HTTP API for easy integration
- **Health Monitoring**: Built-in health checks and monitoring endpoints

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway  │───▶│ Analytics API   │───▶│  PostgreSQL     │
│                │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Redis Cache   │
                       │                 │
                       └─────────────────┘
```

## Prerequisites

- Go 1.21+
- Docker and Docker Compose
- PostgreSQL 15+

## Quick Start with Docker

1. **Clone the repository and navigate to the project root:**
   ```bash
   cd /path/to/seentics
   ```

2. **Copy the environment file:**
   ```bash
   cp env.example .env
   ```

3. **Update the .env file with your configuration:**
   ```bash
   # Edit .env file with your database credentials and API keys
   nano .env
   ```

4. **Start all services:**
   ```bash
   docker-compose up -d
   ```

5. **Check service status:**
   ```bash
   docker-compose ps
   ```

6. **View logs:**
   ```bash
   docker-compose logs -f analytics-service
   ```

## Manual Setup

### 1. Install Dependencies

```bash
go mod download
```

### 2. Configure Environment Variables

Create a `.env` file in the service directory:

```bash
ENVIRONMENT=development
PORT=3002
DATABASE_URL=postgres://user:pass@localhost:5432/analytics?sslmode=disable
LOG_LEVEL=info
JWT_SECRET=your-secret-key
BATCH_SIZE=1000
BATCH_TIMEOUT=5s
WORKER_COUNT=10
RETENTION_DAYS=30
MAX_DB_CONNECTIONS=100
AGGREGATION_INTERVAL=24h
AGGREGATION_TIME=00:00
```

### 3. Setup Database

The service uses PostgreSQL. You can run it with Docker:

```bash
docker run -d --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=pass \
  -e POSTGRES_DB=analytics \
  -p 5432:5432 \
  postgres:15-alpine
```

### 4. Run Migrations

The service will automatically run migrations on startup, or you can run them manually:

```bash
# Using the migrate CLI
migrate -path migrations -database "postgres://user:pass@localhost:5432/analytics?sslmode=disable" up
```

### 5. Build and Run

```bash
# Build the service
go build -o analytics-app .

# Run the service
./analytics-app
```

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Analytics
- `POST /api/v1/analytics/event` - Track single event
- `POST /api/v1/analytics/event/batch` - Track batch events
- `GET /api/v1/analytics/dashboard/:website_id` - Get dashboard metrics
- `GET /api/v1/analytics/realtime/:website_id` - Get real-time data
- `GET /api/v1/analytics/top-pages/:website_id` - Get top pages
- `GET /api/v1/analytics/top-referrers/:website_id` - Get top referrers
- `GET /api/v1/analytics/top-countries/:website_id` - Get top countries
- `GET /api/v1/analytics/top-browsers/:website_id` - Get top browsers
- `GET /api/v1/analytics/top-devices/:website_id` - Get top devices
- `GET /api/v1/analytics/top-os/:website_id` - Get top operating systems
- `GET /api/v1/analytics/traffic-summary/:website_id` - Get traffic summary
- `GET /api/v1/analytics/daily-stats/:website_id` - Get daily statistics
- `GET /api/v1/analytics/hourly-stats/:website_id` - Get hourly statistics
- `GET /api/v1/analytics/custom-events/:website_id` - Get custom events

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | Environment (development/production) |
| `PORT` | `3002` | Service port |
| `DATABASE_URL` | `postgres://...` | PostgreSQL connection string |
| `LOG_LEVEL` | `info` | Logging level |
| `JWT_SECRET` | `your-secret-key` | JWT signing secret |
| `BATCH_SIZE` | `1000` | Event batch size for processing |
| `BATCH_TIMEOUT` | `5s` | Batch timeout |
| `WORKER_COUNT` | `10` | Number of worker goroutines |
| `RETENTION_DAYS` | `30` | Data retention period |
| `MAX_DB_CONNECTIONS` | `100` | Maximum database connections |
| `AGGREGATION_INTERVAL` | `24h` | Aggregation interval |
| `AGGREGATION_TIME` | `00:00` | Aggregation time |

### Database Configuration

The service is optimized for PostgreSQL with the following features:

- **Partitioning**: Automatic partitioning by time for better performance
- **Indexing**: Optimized indexes for time-series queries
- **Retention**: Automatic data cleanup after 90 days
- **Continuous Aggregates**: Pre-computed hourly and daily statistics
- **Connection Pooling**: Optimized connection management

## Development

### Project Structure

```
services/analytics/
├── config/          # Configuration management
├── database/        # Database connection and migrations
├── handlers/        # HTTP request handlers
├── middleware/      # HTTP middleware
├── migrations/      # Database migrations
├── models/          # Data models
├── repository/      # Data access layer
├── services/        # Business logic
├── tests/           # Test files
├── utils/           # Utility functions
├── Dockerfile       # Docker configuration
├── go.mod           # Go module file
├── go.sum           # Go module checksums
├── main.go          # Application entry point
└── README.md        # This file
```

### Running Tests

```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run specific test
go test ./handlers -v
```

### Code Quality

```bash
# Format code
go fmt ./...

# Run linter
golangci-lint run

# Check for security issues
gosec ./...
```

## Monitoring and Health Checks

The service includes built-in health monitoring:

- **Health Endpoint**: `GET /health` returns service status
- **Database Connectivity**: Checks PostgreSQL connection
- **Docker Health Check**: Container-level health monitoring
- **Structured Logging**: JSON-formatted logs with correlation IDs

## Performance Tuning

### Database Optimization

- Connection pooling with configurable limits
- Prepared statements for repeated queries
- Indexes on frequently queried columns
- PostgreSQL partitioning and indexing optimizations

### Application Optimization

- Efficient JSON handling with `json.RawMessage`
- Goroutine pools for concurrent processing
- Batch processing for high-volume events
- Memory-efficient data structures

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection string in environment
   - Ensure network connectivity

2. **Migration Errors**
   - Check PostgreSQL is accessible
   - Verify database user permissions
   - Check migration file syntax

3. **Performance Issues**
   - Monitor database connection pool usage
   - Check PostgreSQL partition performance
   - Review query performance with `EXPLAIN ANALYZE`

### Logs

```bash
# View service logs
docker-compose logs -f analytics-service

# View database logs
docker-compose logs -f postgres
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.