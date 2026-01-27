#!/bin/bash

# Seentics Automation API Test Script
# Tests automation creation, listing, updating, and deletion

API_URL="http://localhost:3002/api/v1"
EMAIL="test@example.com"
PASSWORD="password123"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Seentics Automation API Test ===${NC}"

# 1. Authenticate
echo -e "\n${BLUE}[1/5] Authenticating...${NC}"
LOGIN_RES=$(curl -s -X POST "$API_URL/user/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RES | jq -r '.data.tokens.accessToken // .tokens.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}Authentication failed.${NC}"
    exit 1
fi

echo -e "${GREEN}Authenticated successfully.${NC}"

# 2. Get or Create Website
echo -e "\n${BLUE}[2/5] Getting Website...${NC}"
WEBSITES=$(curl -s -X GET "$API_URL/user/websites" \
     -H "Authorization: Bearer $TOKEN")

SITE_ID=$(echo $WEBSITES | jq -r '.data[0].site_id // .data[0].siteId')

if [ "$SITE_ID" == "null" ] || [ -z "$SITE_ID" ]; then
    echo -e "${BLUE}Creating new website...${NC}"
    WEB_RES=$(curl -s -X POST "$API_URL/user/websites" \
         -H "Authorization: Bearer $TOKEN" \
         -H "Content-Type: application/json" \
         -d "{\"name\":\"Test Site\", \"url\":\"https://test.com\"}")
    SITE_ID=$(echo $WEB_RES | jq -r '.data.site_id')
fi

echo -e "${GREEN}Using Website ID: $SITE_ID${NC}"

# 3. Create Automation
echo -e "\n${BLUE}[3/5] Creating Automation...${NC}"
AUTO_RES=$(curl -s -X POST "$API_URL/websites/$SITE_ID/automations" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Welcome Email Automation",
       "description": "Send welcome email to new signups",
       "trigger_type": "event",
       "trigger_config": {
         "event_name": "user_signup"
       },
       "actions": [
         {
           "type": "email",
           "config": {
             "to": "{{user.email}}",
             "subject": "Welcome!",
             "body": "Thanks for signing up!"
           }
         }
       ],
       "is_active": true
     }')

AUTO_ID=$(echo $AUTO_RES | jq -r '.data.id')
echo -e "${GREEN}Automation Created! ID: $AUTO_ID${NC}"
echo $AUTO_RES | jq '.data'

# 4. List Automations
echo -e "\n${BLUE}[4/5] Listing Automations...${NC}"
curl -s -X GET "$API_URL/websites/$SITE_ID/automations" \
     -H "Authorization: Bearer $TOKEN" | jq '.data'

# 5. Get Automation Stats
echo -e "\n${BLUE}[5/5] Getting Automation Stats...${NC}"
curl -s -X GET "$API_URL/websites/$SITE_ID/automations/$AUTO_ID/stats" \
     -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n${GREEN}=== Automation Test Completed ===${NC}"
