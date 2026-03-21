# ── Build stage ─────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Cache module downloads
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o main ./cmd/api

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -g 1000 app \
    && adduser -D -u 1000 -G app app

WORKDIR /app

# Copy binary and data directory from builder
COPY --from=builder /app/main ./main
COPY --from=builder /app/data ./data
COPY --from=builder /app/internal/shared/migrations ./internal/shared/migrations

USER app

EXPOSE 3002
CMD ["./main"]
