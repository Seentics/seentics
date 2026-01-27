#!/bin/bash

# Seentics Analytics Load Test Script
# Sends thousands of analytics events to test system performance

API_URL="http://localhost:3002/api/v1"
EMAIL="test@example.com"
PASSWORD="password123"
NUM_EVENTS=${1:-5000}  # Default 5000 events, can be overridden
BATCH_SIZE=100
CONCURRENT_REQUESTS=10

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== Seentics Analytics Load Test ===${NC}"
echo -e "${YELLOW}Target: $NUM_EVENTS events${NC}"
echo -e "${YELLOW}Batch size: $BATCH_SIZE${NC}"
echo -e "${YELLOW}Concurrent requests: $CONCURRENT_REQUESTS${NC}"

# 1. Authenticate
echo -e "\n${BLUE}[1/4] Authenticating...${NC}"
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
echo -e "\n${BLUE}[2/4] Getting Website...${NC}"
WEBSITES=$(curl -s -X GET "$API_URL/user/websites" \
     -H "Authorization: Bearer $TOKEN")

SITE_ID=$(echo $WEBSITES | jq -r '.data[0].site_id // .data[0].siteId')

if [ "$SITE_ID" == "null" ] || [ -z "$SITE_ID" ]; then
    echo -e "${BLUE}Creating new website...${NC}"
    WEB_RES=$(curl -s -X POST "$API_URL/user/websites" \
         -H "Authorization: Bearer $TOKEN" \
         -H "Content-Type: application/json" \
         -d "{\"name\":\"Load Test Site\", \"url\":\"https://loadtest.com\"}")
    SITE_ID=$(echo $WEB_RES | jq -r '.data.site_id')
fi

echo -e "${GREEN}Using Website ID: $SITE_ID${NC}"

# 3. Generate and Send Events
echo -e "\n${BLUE}[3/4] Sending $NUM_EVENTS events...${NC}"

# Arrays for random data
PAGES=("/home" "/about" "/pricing" "/features" "/contact" "/blog" "/docs" "/api" "/dashboard" "/settings")
COUNTRIES=("US" "GB" "DE" "FR" "CA" "AU" "JP" "IN" "BR" "ES")
BROWSERS=("Chrome" "Firefox" "Safari" "Edge" "Opera")
OS_LIST=("Windows" "MacOS" "Linux" "iOS" "Android")
DEVICES=("desktop" "mobile" "tablet")
REFERRERS=("https://google.com" "https://twitter.com" "https://facebook.com" "direct" "https://linkedin.com")

# Function to send a batch of events
send_batch() {
    local batch_num=$1
    local events_json="["
    
    # Define arrays locally to avoid export issues
    local PAGES=("/home" "/about" "/pricing" "/features" "/contact" "/blog" "/docs" "/api" "/dashboard" "/settings")
    local COUNTRIES=("US" "GB" "DE" "FR" "CA" "AU" "JP" "IN" "BR" "ES")
    local BROWSERS=("Chrome" "Firefox" "Safari" "Edge" "Opera")
    local OS_LIST=("Windows" "MacOS" "Linux" "iOS" "Android")
    local DEVICES=("desktop" "mobile" "tablet")
    local REFERRERS=("https://google.com" "https://twitter.com" "https://facebook.com" "direct" "https://linkedin.com")
    
    for i in $(seq 1 $BATCH_SIZE); do
        local page_idx=$((RANDOM % 10))
        local country_idx=$((RANDOM % 10))
        local browser_idx=$((RANDOM % 5))
        local os_idx=$((RANDOM % 5))
        local device_idx=$((RANDOM % 3))
        local referrer_idx=$((RANDOM % 5))
        
        local page=${PAGES[$page_idx]}
        local country=${COUNTRIES[$country_idx]}
        local browser=${BROWSERS[$browser_idx]}
        local os=${OS_LIST[$os_idx]}
        local device=${DEVICES[$device_idx]}
        local referrer=${REFERRERS[$referrer_idx]}
        local visitor_id="visitor-$RANDOM-$RANDOM"
        local session_id="session-$RANDOM"
        
        events_json+="{
            \"website_id\": \"$SITE_ID\",
            \"visitor_id\": \"$visitor_id\",
            \"session_id\": \"$session_id\",
            \"event_type\": \"pageview\",
            \"page\": \"$page\",
            \"referrer\": \"$referrer\",
            \"country\": \"$country\",
            \"browser\": \"$browser\",
            \"os\": \"$os\",
            \"device\": \"$device\"
        }"
        
        if [ $i -lt $BATCH_SIZE ]; then
            events_json+=","
        fi
    done
    
    events_json+="]"
    
    # Send batch request
    curl -s -X POST "$API_URL/analytics/batch" \
         -H "Content-Type: application/json" \
         -d "{\"site_id\": \"$SITE_ID\", \"events\": $events_json}" > /dev/null
}

# Export function for parallel execution
export -f send_batch
export API_URL SITE_ID BATCH_SIZE NUM_EVENTS

# Calculate number of batches
NUM_BATCHES=$((NUM_EVENTS / BATCH_SIZE))

# Start time
START_TIME=$(date +%s)

# Send events in parallel batches
echo -e "${YELLOW}Starting load test...${NC}"
seq 1 $NUM_BATCHES | xargs -P $CONCURRENT_REQUESTS -I {} bash -c 'send_batch {}'

# End time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Avoid division by zero
if [ $DURATION -eq 0 ]; then
    DURATION=1
fi

echo -e "\n${GREEN}Load test completed!${NC}"
echo -e "${BLUE}Total events sent: $((NUM_BATCHES * BATCH_SIZE))${NC}"
echo -e "${BLUE}Duration: ${DURATION}s${NC}"
echo -e "${BLUE}Throughput: $((NUM_BATCHES * BATCH_SIZE / DURATION)) events/sec${NC}"

# 4. Wait for processing and verify
echo -e "\n${BLUE}[4/4] Waiting for Kafka processing (15s)...${NC}"
sleep 15

echo -e "\n${BLUE}Verifying data...${NC}"
DASHBOARD=$(curl -s -X GET "$API_URL/analytics/dashboard/$SITE_ID?days=1" \
     -H "Authorization: Bearer $TOKEN")

TOTAL_VISITORS=$(echo $DASHBOARD | jq -r '.total_visitors')
PAGE_VIEWS=$(echo $DASHBOARD | jq -r '.page_views')

echo -e "${GREEN}Dashboard Stats:${NC}"
echo -e "  Total Visitors: $TOTAL_VISITORS"
echo -e "  Page Views: $PAGE_VIEWS"

echo -e "\n${GREEN}=== Load Test Summary ===${NC}"
echo -e "${BLUE}Events Sent: $((NUM_BATCHES * BATCH_SIZE))${NC}"
echo -e "${BLUE}Duration: ${DURATION}s${NC}"
echo -e "${BLUE}Throughput: $((NUM_BATCHES * BATCH_SIZE / DURATION)) events/sec${NC}"
echo -e "${BLUE}Page Views Recorded: $PAGE_VIEWS${NC}"
