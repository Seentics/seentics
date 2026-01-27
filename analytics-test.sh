#!/bin/bash

# Seentics Analytics API Comprehensive Test Script
# Tests ALL analytics endpoints with real data

API_URL="http://localhost:3002/api/v1"
EMAIL="test@example.com"
PASSWORD="password123"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test results
PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local response=$2
    local expected_field=$3
    
    if echo "$response" | jq -e "$expected_field" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ $name${NC}"
        echo "  Response: $response"
        ((FAILED++))
    fi
}

echo -e "${BLUE}=== Seentics Analytics API Comprehensive Test ===${NC}"

# 1. Authenticate
echo -e "\n${BLUE}[1/3] Authenticating...${NC}"
LOGIN_RES=$(curl -s -X POST "$API_URL/user/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RES | jq -r '.data.tokens.accessToken // .tokens.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}Authentication failed.${NC}"
    exit 1
fi

echo -e "${GREEN}Authenticated successfully.${NC}"

# 2. Get Website
echo -e "\n${BLUE}[2/3] Getting Website...${NC}"
WEBSITES=$(curl -s -X GET "$API_URL/user/websites" \
     -H "Authorization: Bearer $TOKEN")

SITE_ID=$(echo $WEBSITES | jq -r '.data[0].site_id // .data[0].siteId')

if [ "$SITE_ID" == "null" ] || [ -z "$SITE_ID" ]; then
    echo -e "${RED}No website found. Please run load-test.sh first.${NC}"
    exit 1
fi

echo -e "${GREEN}Using Website ID: $SITE_ID${NC}"

# 3. Test All Analytics Endpoints
echo -e "\n${BLUE}[3/3] Testing Analytics Endpoints...${NC}\n"

echo -e "${YELLOW}Core Analytics:${NC}"

# Dashboard
RESP=$(curl -s -X GET "$API_URL/analytics/dashboard/$SITE_ID?days=7" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Dashboard (7 days)" "$RESP" ".total_visitors"

RESP=$(curl -s -X GET "$API_URL/analytics/dashboard/$SITE_ID?days=30" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Dashboard (30 days)" "$RESP" ".page_views"

# Top Pages
RESP=$(curl -s -X GET "$API_URL/analytics/top-pages/$SITE_ID?days=7&limit=10" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Top Pages" "$RESP" ".top_pages"

# Top Referrers
RESP=$(curl -s -X GET "$API_URL/analytics/top-referrers/$SITE_ID?days=7&limit=10" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Top Referrers" "$RESP" ".top_referrers"

# Top Sources
RESP=$(curl -s -X GET "$API_URL/analytics/top-sources/$SITE_ID?days=7&limit=10" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Top Sources" "$RESP" ".top_sources"

echo -e "\n${YELLOW}Geographic Analytics:${NC}"

# Top Countries
RESP=$(curl -s -X GET "$API_URL/analytics/top-countries/$SITE_ID?days=7&limit=10" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Top Countries" "$RESP" ".top_countries"

# Geolocation Breakdown
RESP=$(curl -s -X GET "$API_URL/analytics/geolocation-breakdown/$SITE_ID?days=7" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Geolocation Breakdown" "$RESP" ".countries"

echo -e "\n${YELLOW}Device & Browser Analytics:${NC}"

# Top Browsers
RESP=$(curl -s -X GET "$API_URL/analytics/top-browsers/$SITE_ID?days=7&limit=10" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Top Browsers" "$RESP" ".top_browsers"

# Top Devices
RESP=$(curl -s -X GET "$API_URL/analytics/top-devices/$SITE_ID?days=7&limit=10" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Top Devices" "$RESP" ".top_devices"

# Top OS
RESP=$(curl -s -X GET "$API_URL/analytics/top-os/$SITE_ID?days=7&limit=10" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Top OS" "$RESP" ".top_os"

echo -e "\n${YELLOW}Time-based Analytics:${NC}"

# Daily Stats
RESP=$(curl -s -X GET "$API_URL/analytics/daily-stats/$SITE_ID?days=30" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Daily Stats (30 days)" "$RESP" ".daily_stats"

RESP=$(curl -s -X GET "$API_URL/analytics/daily-stats/$SITE_ID?days=7" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Daily Stats (7 days)" "$RESP" ".daily_stats"

# Hourly Stats
RESP=$(curl -s -X GET "$API_URL/analytics/hourly-stats/$SITE_ID?timezone=UTC" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Hourly Stats (UTC)" "$RESP" ".hourly_stats"

RESP=$(curl -s -X GET "$API_URL/analytics/hourly-stats/$SITE_ID?timezone=America/New_York" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Hourly Stats (EST)" "$RESP" ".hourly_stats"

echo -e "\n${YELLOW}Traffic Analytics:${NC}"

# Traffic Summary
RESP=$(curl -s -X GET "$API_URL/analytics/traffic-summary/$SITE_ID?days=7" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Traffic Summary" "$RESP" ".total_page_views"

# Activity Trends
RESP=$(curl -s -X GET "$API_URL/analytics/activity-trends/$SITE_ID" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Activity Trends" "$RESP" ".trends"

echo -e "\n${YELLOW}Visitor Analytics:${NC}"

# Live Visitors
RESP=$(curl -s -X GET "$API_URL/analytics/live-visitors/$SITE_ID" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Live Visitors" "$RESP" ".live_visitors"

# Visitor Insights
RESP=$(curl -s -X GET "$API_URL/analytics/visitor-insights/$SITE_ID?days=7" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Visitor Insights" "$RESP" ".new_visitors"

# User Retention
RESP=$(curl -s -X GET "$API_URL/analytics/user-retention/$SITE_ID?days=30" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "User Retention" "$RESP" ".day_1"

echo -e "\n${YELLOW}Custom Events & UTM:${NC}"

# Custom Events
RESP=$(curl -s -X GET "$API_URL/analytics/custom-events/$SITE_ID?days=7" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Custom Events" "$RESP" ".top_events"

# Page UTM Breakdown (requires a page parameter)
RESP=$(curl -s -X GET "$API_URL/analytics/page-utm-breakdown/$SITE_ID?page_path=/home&days=7" \
     -H "Authorization: Bearer $TOKEN")
test_endpoint "Page UTM Breakdown" "$RESP" ".campaigns"

echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${BLUE}Total: $((PASSED + FAILED))${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed!${NC}"
    exit 1
fi
