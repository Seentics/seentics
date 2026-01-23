#!/bin/bash

# Database Migration Runner for Analytics Service
# This script runs database migrations manually

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Running Analytics Service Database Migrations (PostgreSQL)${NC}"

# Check if we're in the right directory
if [ ! -f "migrations/migrate.go" ]; then
    echo -e "${RED}❌ Error: Please run this script from the analytics service directory${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    exit 1
fi

# Check if PostgreSQL container is running
if ! docker-compose ps postgres | grep -q "Up"; then
    echo -e "${YELLOW}⚠️  PostgreSQL container is not running. Starting services...${NC}"
    docker-compose up -d postgres
    echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
    sleep 10
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Run migrations
echo -e "${YELLOW}🔄 Running migrations...${NC}"

# Copy migration files to container
docker cp migrations/000001_initial_schema.up.sql postgres:/tmp/000001_initial_schema.up.sql

# Run migrations in order
echo -e "${YELLOW}📝 Running migration 000001_initial_schema.up.sql...${NC}"
docker-compose exec postgres psql -U seentics -d seentics_analytics -f /tmp/000001_initial_schema.up.sql

echo -e "${GREEN}✅ All migrations completed successfully!${NC}"

# Verify tables were created
echo -e "${YELLOW}🔍 Verifying database schema...${NC}"
docker-compose exec postgres psql -U seentics -d seentics_analytics -c "\dt"

echo -e "${GREEN}🎉 Database migrations completed successfully!${NC}"
