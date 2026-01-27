#!/bin/bash

# Automation System Test Script
# Tests automation creation, webhook, email, and execution

API_URL="http://localhost:3002/api/v1"
EMAIL="test@example.com"
PASSWORD="password123"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== Automation System Test ===${NC}\n"

# 1. Authenticate
echo -e "${BLUE}[1/6] Authenticating...${NC}"
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
    echo -e "${RED}No website found.${NC}"
    exit 1
fi

echo -e "${GREEN}Using Website ID: $SITE_ID${NC}"

# 3. Create Webhook Automation
echo -e "\n${BLUE}[3/6] Creating Webhook Automation...${NC}"
WEBHOOK_AUTO=$(curl -s -X POST "$API_URL/websites/$SITE_ID/automations" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Webhook Test",
       "description": "Send webhook on pageview",
       "triggerType": "pageview",
       "triggerConfig": {
         "frequency": "always"
       },
       "actions": [
         {
           "actionType": "webhook",
           "actionConfig": {
             "url": "https://webhook.site/unique-id",
             "method": "POST",
             "headers": {},
             "body": {
               "event": "pageview",
               "test": true
             }
           }
         }
       ]
     }')

WEBHOOK_ID=$(echo $WEBHOOK_AUTO | jq -r '.id')
echo -e "${GREEN}Webhook Automation Created! ID: $WEBHOOK_ID${NC}"

# 4. Create Email Automation
echo -e "\n${BLUE}[4/6] Creating Email Automation...${NC}"
EMAIL_AUTO=$(curl -s -X POST "$API_URL/websites/$SITE_ID/automations" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Welcome Email",
       "description": "Send welcome email on signup",
       "triggerType": "event",
       "triggerConfig": {
         "event_name": "user_signup",
         "frequency": "once_per_visitor"
       },
       "actions": [
         {
           "actionType": "email",
           "actionConfig": {
             "to": "user@example.com",
             "subject": "Welcome!",
             "body": "Thanks for signing up!"
           }
         }
       ]
     }')

EMAIL_ID=$(echo $EMAIL_AUTO | jq -r '.id')
echo -e "${GREEN}Email Automation Created! ID: $EMAIL_ID${NC}"

# 5. Create Banner Automation
echo -e "\n${BLUE}[5/6] Creating Banner Automation...${NC}"
BANNER_AUTO=$(curl -s -X POST "$API_URL/websites/$SITE_ID/automations" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Exit Intent Banner",
       "description": "Show banner on exit intent",
       "triggerType": "page_exit",
       "triggerConfig": {
         "frequency": "once_per_session"
       },
       "actions": [
         {
           "actionType": "banner",
           "actionConfig": {
             "content": "Wait! Get 20% off your first purchase!",
             "position": "bottom",
             "backgroundColor": "#4F46E5",
             "textColor": "#FFFFFF",
             "closeButton": true
           }
         }
       ]
     }')

BANNER_ID=$(echo $BANNER_AUTO | jq -r '.id')
echo -e "${GREEN}Banner Automation Created! ID: $BANNER_ID${NC}"

# 6. List All Automations
echo -e "\n${BLUE}[6/6] Listing All Automations...${NC}"
curl -s -X GET "$API_URL/websites/$SITE_ID/automations" \
     -H "Authorization: Bearer $TOKEN" | jq '.automations[] | {id, name, triggerType, isActive, actions: .actions | length}'

echo -e "\n${GREEN}=== Automation System Test Completed ===${NC}"
echo -e "${BLUE}Created 3 automations:${NC}"
echo -e "  1. Webhook: $WEBHOOK_ID"
echo -e "  2. Email: $EMAIL_ID"
echo -e "  3. Banner: $BANNER_ID"
