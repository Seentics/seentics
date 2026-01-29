#!/bin/bash

echo "🛑 Stopping all containers..."
docker compose down

echo "🗑️  Removing volumes (WARNING: Deletes database data)..."
docker compose down -v

echo "🧹 Pruning unused images..."
docker system prune -f

echo "⬇️  Pulling latest code..."
git pull

echo "🚀 Restarting Nginx and requesting SSL certs..."
# Make sure init-letsencrypt is executable
chmod +x init-letsencrypt.sh
sudo ./init-letsencrypt.sh

echo "✅ Done! Your server should be live at https://api.seentics.com"
