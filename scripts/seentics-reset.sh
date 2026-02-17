#!/bin/bash
# seentics-reset.sh
# Forcefully cleans up all seentics and minio containers/networks to resolve DNS conflicts.

echo "🛑 Stopping and removing all seentics, minio, and analytics containers..."
docker ps -a --format '{{.Names}}' | grep -E "seentics|minio|analytics-backend" | xargs -r docker stop
docker ps -a --format '{{.Names}}' | grep -E "seentics|minio|analytics-backend" | xargs -r docker rm

echo "🧹 Cleaning up docker networks..."
docker network ls --format '{{.Name}}' | grep -E "seentics|analytics" | xargs -r docker network rm

echo "🚀 Starting fresh deployment..."
docker compose up -d --build

echo "✅ Done! Waiting for services to be healthy..."
sleep 10
docker compose ps
