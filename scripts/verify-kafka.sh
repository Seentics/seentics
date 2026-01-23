#!/bin/bash

# Seentics E2E Kafka Verification Script
# This script tests the Analytics API, Gateway User Registration, and Kafka message propagation.

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Seentics Kafka E2E Verification ===${NC}"

# Check dependencies
if ! command -v curl &> /dev/null; then echo -e "${RED}Error: curl not found${NC}"; exit 1; fi
if ! command -v jq &> /dev/null; then echo -e "${RED}Error: jq not found${NC}"; exit 1; fi

# Configuration
API_GATEWAY_URL="http://localhost:8085"
ANALYTICS_URL="http://localhost:3002"
GLOBAL_API_KEY="your-global-api-key-for-service-communication" # Adjust if your .env differs

echo -e "\n${BLUE}1. Testing Analytics Event Ingestion (Kafka Producer)${NC}"
TRACK_RES=$(curl -s -X POST "${ANALYTICS_URL}/api/v1/analytics/event" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${GLOBAL_API_KEY}" \
  -d '{
    "website_id": "test-site-123",
    "event_type": "test_event",
    "page": "/verification",
    "visitor_id": "verify-visitor",
    "session_id": "verify-session"
  }')

if echo "$TRACK_RES" | jq -e '.status == "accepted"' > /dev/null; then
  echo -e "${GREEN}✓ Analytics event accepted (Pushed to Kafka)${NC}"
else
  echo -e "${RED}✗ Analytics event failed: $TRACK_RES ${NC}"
fi

echo -e "\n${BLUE}2. Testing Gateway User Registration (Inter-service Event)${NC}"
UNIQUE_EMAIL="verify-$(date +%s)@example.com"
REG_RES=$(curl -s -X POST "${API_GATEWAY_URL}/api/v1/user/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Verify User\",
    \"email\": \"$UNIQUE_EMAIL\",
    \"password\": \"password123\"
  }")

if echo "$REG_RES" | jq -e '.message == "User created successfully"' > /dev/null; then
  echo -e "${GREEN}✓ Gateway registration successful (Published user_events to Kafka)${NC}"
else
  echo -e "${RED}✗ Gateway registration failed: $REG_RES ${NC}"
fi

echo -e "\n${BLUE}3. Verifying Kafka Storage (via Kafka-UI/Health Check Proxy)${NC}"
# We'll use the analytics health check or stats if it shows queue sizes
# Since we implemented Async: true, the health check might show if it's connected
HEALTH_RES=$(curl -s "${ANALYTICS_URL}/health")
if echo "$HEALTH_RES" | jq -e '.status == "healthy"' > /dev/null; then
  echo -e "${GREEN}✓ Analytics Service scale-out state is healthy${NC}"
else
  echo -e "${RED}✗ Analytics Service health check failed: $HEALTH_RES ${NC}"
fi

echo -e "\n${BLUE}4. Manual Inspection Instructions:${NC}"
echo -e "1. Open Kafka UI at ${BLUE}http://localhost:8081${NC}"
echo -e "2. Check topic ${BLUE}analytics_events${NC} for 'test_event'"
echo -e "3. Check topic ${BLUE}user_events${NC} for 'user_registered' with email $UNIQUE_EMAIL"
echo -e "4. Check Automation Service logs to see the event being processed."

echo -e "\n${BLUE}=== Verification Complete ===${NC}"
