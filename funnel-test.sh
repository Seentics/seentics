#!/bin/bash

# Seentics Funnel API Test Script
# Tests funnel creation, tracking, and stats retrieval

API_URL="http://localhost:3002/api/v1"
EMAIL="test@example.com"
PASSWORD="password123"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Seentics Funnel API Test ===${NC}"

# 1. Authenticate
echo -e "\n${BLUE}[1/6] Authenticating...${NC}"
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
echo -e "\n${BLUE}[2/6] Getting Website...${NC}"
WEBSITES=$(curl -s -X GET "$API_URL/user/websites" \
     -H "Authorization: Bearer $TOKEN")

SITE_ID=$(echo $WEBSITES | jq -r '.data[0].site_id // .data[0].siteId')

if [ "$SITE_ID" == "null" ] || [ -z "$SITE_ID" ]; then
    echo -e "${RED}No website found. Please create one first.${NC}"
    exit 1
fi

echo -e "${GREEN}Using Website ID: $SITE_ID${NC}"

# 3. Create Funnel
echo -e "\n${BLUE}[3/6] Creating Funnel...${NC}"
FUNNEL_RES=$(curl -s -X POST "$API_URL/websites/$SITE_ID/funnels" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Signup Funnel",
       "description": "Track user signup journey",
       "steps": [
         {
           "name": "Landing Page",
           "type": "pageview",
           "identifier": "/",
           "order": 1
         },
         {
           "name": "Pricing Page",
           "type": "pageview",
           "identifier": "/pricing",
           "order": 2
         },
         {
           "name": "Signup",
           "type": "event",
           "identifier": "user_signup",
           "order": 3
         }
       ],
       "is_active": true
     }')

FUNNEL_ID=$(echo $FUNNEL_RES | jq -r '.data.id')
echo -e "${GREEN}Funnel Created! ID: $FUNNEL_ID${NC}"
echo $FUNNEL_RES | jq '.data'

# 4. List Funnels
echo -e "\n${BLUE}[4/6] Listing Funnels...${NC}"
curl -s -X GET "$API_URL/websites/$SITE_ID/funnels" \
     -H "Authorization: Bearer $TOKEN" | jq '.data'

# 5. Track Funnel Events
echo -e "\n${BLUE}[5/6] Tracking Funnel Events...${NC}"
VISITOR_ID="test-visitor-$(date +%s)"

# Step 1: Landing page
curl -s -X POST "$API_URL/funnels/track" \
     -H "Content-Type: application/json" \
     -d "{
       \"website_id\": \"$SITE_ID\",
       \"funnel_id\": \"$FUNNEL_ID\",
       \"visitor_id\": \"$VISITOR_ID\",
       \"step_identifier\": \"/\",
       \"step_type\": \"pageview\"
     }" > /dev/null

echo -e "Tracked: Landing Page"

# Step 2: Pricing page
curl -s -X POST "$API_URL/funnels/track" \
     -H "Content-Type: application/json" \
     -d "{
       \"website_id\": \"$SITE_ID\",
       \"funnel_id\": \"$FUNNEL_ID\",
       \"visitor_id\": \"$VISITOR_ID\",
       \"step_identifier\": \"/pricing\",
       \"step_type\": \"pageview\"
     }" > /dev/null

echo -e "Tracked: Pricing Page"

# 6. Get Funnel Stats
echo -e "\n${BLUE}[6/6] Getting Funnel Stats...${NC}"
sleep 2
curl -s -X GET "$API_URL/websites/$SITE_ID/funnels/$FUNNEL_ID/stats" \
     -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n${GREEN}=== Funnel Test Completed ===${NC}"
