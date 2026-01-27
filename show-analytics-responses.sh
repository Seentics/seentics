#!/bin/bash

# Seentics Analytics API Response Viewer
# Shows actual responses from all analytics GET endpoints

API_URL="http://localhost:3002/api/v1"
EMAIL="test@example.com"
PASSWORD="password123"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== Seentics Analytics API Responses ===${NC}\n"

# Authenticate
LOGIN_RES=$(curl -s -X POST "$API_URL/user/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RES | jq -r '.data.tokens.accessToken // .tokens.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}Authentication failed.${NC}"
    exit 1
fi

# Get Website
WEBSITES=$(curl -s -X GET "$API_URL/user/websites" \
     -H "Authorization: Bearer $TOKEN")

SITE_ID=$(echo $WEBSITES | jq -r '.data[0].site_id // .data[0].siteId')

echo -e "${GREEN}Using Website ID: $SITE_ID${NC}\n"

# Function to display endpoint response
show_response() {
    local title=$1
    local endpoint=$2
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$title${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Endpoint: ${GREEN}$endpoint${NC}\n"
    
    curl -s -X GET "$API_URL$endpoint" \
         -H "Authorization: Bearer $TOKEN" | jq '.'
    
    echo -e "\n"
}

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           CORE ANALYTICS ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}\n"

show_response "1. Dashboard (7 days)" "/analytics/dashboard/$SITE_ID?days=7"
show_response "2. Dashboard (30 days)" "/analytics/dashboard/$SITE_ID?days=30"
show_response "3. Top Pages" "/analytics/top-pages/$SITE_ID?days=7&limit=10"
show_response "4. Top Referrers" "/analytics/top-referrers/$SITE_ID?days=7&limit=10"
show_response "5. Top Sources" "/analytics/top-sources/$SITE_ID?days=7&limit=10"

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        GEOGRAPHIC ANALYTICS ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}\n"

show_response "6. Top Countries" "/analytics/top-countries/$SITE_ID?days=7&limit=10"
show_response "7. Geolocation Breakdown" "/analytics/geolocation-breakdown/$SITE_ID?days=7"

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}      DEVICE & BROWSER ANALYTICS ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}\n"

show_response "8. Top Browsers" "/analytics/top-browsers/$SITE_ID?days=7&limit=10"
show_response "9. Top Devices" "/analytics/top-devices/$SITE_ID?days=7&limit=10"
show_response "10. Top OS" "/analytics/top-os/$SITE_ID?days=7&limit=10"

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        TIME-BASED ANALYTICS ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}\n"

show_response "11. Daily Stats (30 days)" "/analytics/daily-stats/$SITE_ID?days=30"
show_response "12. Daily Stats (7 days)" "/analytics/daily-stats/$SITE_ID?days=7"
show_response "13. Hourly Stats (UTC)" "/analytics/hourly-stats/$SITE_ID?timezone=UTC"
show_response "14. Hourly Stats (EST)" "/analytics/hourly-stats/$SITE_ID?timezone=America/New_York"

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}         TRAFFIC ANALYTICS ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}\n"

show_response "15. Traffic Summary" "/analytics/traffic-summary/$SITE_ID?days=7"
show_response "16. Activity Trends" "/analytics/activity-trends/$SITE_ID"

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}         VISITOR ANALYTICS ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}\n"

show_response "17. Live Visitors" "/analytics/live-visitors/$SITE_ID"
show_response "18. Visitor Insights" "/analytics/visitor-insights/$SITE_ID?days=7"
show_response "19. User Retention" "/analytics/user-retention/$SITE_ID?days=30"

echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}      CUSTOM EVENTS & UTM ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}\n"

show_response "20. Custom Events" "/analytics/custom-events/$SITE_ID?days=7"
show_response "21. Page UTM Breakdown" "/analytics/page-utm-breakdown/$SITE_ID?page_path=/home&days=7"

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           ALL RESPONSES DISPLAYED${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
