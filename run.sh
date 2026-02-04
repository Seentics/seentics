#!/bin/bash

# Seentics Analytics Local Dev Runner
# This script starts the entire stack locally for development

echo "🚀 Starting Seentics Analytics in Local Development Mode..."

# Check if .env exists, if not create from example or defaults
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating a default one..."
    cat <<EOT > .env
POSTGRES_USER=seentics_admin
POSTGRES_PASSWORD=seentics_pass
POSTGRES_DB=seentics_analytics
REDIS_PASSWORD=seentics_redis_pass
JWT_SECRET=local_dev_secret_32_chars_minimum_length
CORS_ALLOWED_ORIGINS=http://localhost:3000
GLOBAL_API_KEY=dev_key_123
EOT
fi

# Run docker-compose with the local configuration
docker-compose -f docker-compose.local.yml up --build

echo "✅ Local stack is stopping..."
