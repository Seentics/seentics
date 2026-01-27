#!/bin/bash

# Seentics API Test Script
# This script tests the full lifecycle: Auth -> Website -> Analytics -> Settings

API_URL="http://localhost:3002/api/v1"
EMAIL="test@example.com"
PASSWORD="password123"
TEST_SITE_NAME="Test Site $(date +%s)"
TEST_SITE_URL="https://test-site-$(date +%s).com"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Seentics API Test Suite ===${NC}"

# 1. Login/Register
echo -e "\n${BLUE}[1/6] Authenticating...${NC}"
LOGIN_RES=$(curl -s -X POST "$API_URL/user/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RES | jq -r '.data.tokens.accessToken // .tokens.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}Login failed. Attempting registration...${NC}"
    REG_RES=$(curl -s -X POST "$API_URL/user/auth/register" \
         -H "Content-Type: application/json" \
         -d "{\"name\":\"Test User\", \"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")
    TOKEN=$(echo $REG_RES | jq -r '.data.tokens.accessToken // .tokens.accessToken')
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}Authentication failed completely.${NC}"
    echo "Last Response: $LOGIN_RES $REG_RES"
    exit 1
fi

echo -e "${GREEN}Authenticated successfully.${NC}"

# 2. Create Website
echo -e "\n${BLUE}[2/6] Creating Test Website...${NC}"
WEB_RES=$(curl -s -X POST "$API_URL/user/websites" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"$TEST_SITE_NAME\", \"url\":\"$TEST_SITE_URL\"}")

SITE_ID=$(echo $WEB_RES | jq -r '.data.site_id')
TRACKING_ID=$(echo $WEB_RES | jq -r '.data.tracking_id')

if [ "$SITE_ID" == "null" ]; then
    echo -e "${RED}Failed to create website.${NC}"
    echo $WEB_RES
    exit 1
fi

echo -e "${GREEN}Website Created! SiteID: $SITE_ID, TrackingID: $TRACKING_ID${NC}"

# 3. Track Events (Analytics Ingestion)
echo -e "\n${BLUE}[3/6] Sending Analytics Events...${NC}"
for i in {1..3}
do
    echo -e "Sending pageview $i..."
    curl -s -X POST "$API_URL/analytics/event" \
         -H "Content-Type: application/json" \
         -d "{
               \"website_id\": \"$SITE_ID\",
               \"visitor_id\": \"test-visitor-$(date +%s)\",
               \"event_type\": \"pageview\",
               \"page\": \"/home\",
               \"country\": \"US\",
               \"browser\": \"Chrome\",
               \"os\": \"MacOS\",
               \"device\": \"desktop\"
             }" > /dev/null
done

echo -e "Sending custom event..."
curl -s -X POST "$API_URL/analytics/event" \
     -H "Content-Type: application/json" \
     -d "{
           \"website_id\": \"$SITE_ID\",
           \"visitor_id\": \"test-visitor-$(date +%s)\",
           \"event_type\": \"button_click\",
           \"page\": \"/pricing\",
           \"properties\": {\"button_id\": \"signup-btn\", \"color\": \"blue\"}
         }" > /dev/null

echo -e "${GREEN}Events sent successfully.${NC}"
echo -e "${BLUE}Waiting 12s for Kafka processing and database flush...${NC}"
sleep 12

# 4. Fetch Analytics Stats
echo -e "\n${BLUE}[4/6] Fetching Analytics Stats...${NC}"
echo -e "Getting Dashboard Data..."
# Dashboard returns raw object without 'data' wrapper
curl -s -X GET "$API_URL/analytics/dashboard/$SITE_ID" \
     -H "Authorization: Bearer $TOKEN" | jq '.' | head -n 15

echo -e "\nGetting Top Pages..."
# Top pages returns object with 'top_pages' field
curl -s -X GET "$API_URL/analytics/top-pages/$SITE_ID" \
     -H "Authorization: Bearer $TOKEN" | jq '.top_pages'

# 5. Test Settings (Goals)
echo -e "\n${BLUE}[5/6] Testing Goals API...${NC}"
GOAL_RES=$(curl -s -X POST "$API_URL/user/websites/$SITE_ID/goals" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Test Lead\", \"type\":\"event\", \"identifier\":\"button_click\"}")

GOAL_ID=$(echo $GOAL_RES | jq -r '.data.id')
echo -e "${GREEN}Goal Created ID: $GOAL_ID${NC}"

echo -e "Listing Goals..."
curl -s -X GET "$API_URL/user/websites/$SITE_ID/goals" \
     -H "Authorization: Bearer $TOKEN" | jq '.data'

# 6. Test Team Members
echo -e "\n${BLUE}[6/6] Testing Team API...${NC}"
echo -e "Listing Members..."
# Should return at least the owner now
curl -s -X GET "$API_URL/user/websites/$SITE_ID/members" \
     -H "Authorization: Bearer $TOKEN" | jq '.data'

echo -e "\n${GREEN}=== API Test Suite Completed ===${NC}"
echo -e "${BLUE}You can view the dashboard for this site at:${NC}"
echo -e "http://localhost:3000/websites/$SITE_ID"
