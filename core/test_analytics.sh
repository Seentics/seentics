#!/bin/bash

# Configuration
API_URL="http://localhost:3002"
API_KEY="dev_api_key"
WEBSITE_ID="TEST-SITE-001"
USER_ID="TEST-USER-999"

echo "🚀 Starting Analytics Backend API Tests..."
echo "------------------------------------------"

# 1. Health Check
echo "🔍 Testing Health Check..."
HEALTH=$(curl -s "$API_URL/health")
if [[ $HEALTH == *"healthy"* ]]; then
    echo "✅ Health Check: PASSED"
else
    echo "❌ Health Check: FAILED"
    echo "Response: $HEALTH"
    exit 1
fi

# 2. Event Ingestion
echo "📥 Testing Event Ingestion..."
EVENT_RESP=$(curl -s -X POST "$API_URL/api/v1/analytics/event" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d '{
        "website_id": "'$WEBSITE_ID'",
        "visitor_id": "'$USER_ID'",
        "event_type": "page_view",
        "page": "https://example.com/home",
        "referrer": "https://google.com"
    }')

if [[ $EVENT_RESP == *"id"* ]]; then
    echo "✅ Event Ingestion: PASSED"
else
    echo "❌ Event Ingestion: FAILED"
    echo "Response: $EVENT_RESP"
fi

# 3. Batch Event Ingestion
echo "📥 Testing Batch Event Ingestion..."
BATCH_RESP=$(curl -s -X POST "$API_URL/api/v1/analytics/event/batch" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d '{
        "siteId": "'$WEBSITE_ID'",
        "events": [
            {
                "visitor_id": "'$USER_ID'",
                "event_type": "click",
                "page": "https://example.com/button"
            },
            {
                "visitor_id": "'$USER_ID'",
                "event_type": "scroll",
                "page": "https://example.com/footer"
            }
        ]
    }')

if [[ $BATCH_RESP == *"processed_at"* ]]; then
    echo "✅ Batch Event Ingestion: PASSED"
else
    echo "❌ Batch Event Ingestion: FAILED"
    echo "Response: $BATCH_RESP"
fi

# 4. Query APIs (Dashboard Stats)
echo "📊 Testing Dashboard Query API..."
DASHBOARD_RESP=$(curl -s -X GET "$API_URL/api/v1/analytics/dashboard/$WEBSITE_ID" \
    -H "X-API-Key: $API_KEY" \
    -H "X-User-ID: $USER_ID")

if [[ $DASHBOARD_RESP == *"website_id"*:*"$WEBSITE_ID"* ]]; then
    echo "✅ Dashboard Query: PASSED"
else
    echo "❌ Dashboard Query: FAILED"
    echo "Response: $DASHBOARD_RESP"
fi

# 5. Geolocation Breakdown
echo "🌍 Testing Geolocation Query API..."
GEO_RESP=$(curl -s -X GET "$API_URL/api/v1/analytics/geolocation-breakdown/$WEBSITE_ID" \
    -H "X-API-Key: $API_KEY")

if [[ $GEO_RESP == *"countries"* ]]; then
    echo "✅ Geolocation Query: PASSED"
else
    echo "❌ Geolocation Query: FAILED"
    echo "Response: $GEO_RESP"
fi

echo "------------------------------------------"
echo "🏁 API Testing Completed!"
