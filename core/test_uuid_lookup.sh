#!/bin/bash

# Configuration
API_URL="http://localhost:3002"
API_KEY="dev_api_key"
# Example UUID (needs to exist in user's DB for full success, but let's test the 500 -> 404 transition)
WEBSITE_UUID="de7b07e2-8d0e-4701-afba-f54abe9743dc" 
USER_ID="dev-user-id"

echo "🧪 Starting UUID Lookup Verification..."
echo "---------------------------------------"

# 1. Test Dashboard with UUID
echo "🔍 Testing Dashboard with UUID: $WEBSITE_UUID"
DASH_RESP=$(curl -s -i -X GET "$API_URL/api/v1/analytics/dashboard/$WEBSITE_UUID" \
    -H "X-API-Key: $API_KEY" \
    -H "X-User-ID: $USER_ID")

HTTP_STATUS=$(echo "$DASH_RESP" | head -n 1 | cut -d' ' -f2)
BODY=$(echo "$DASH_RESP" | tail -n 1)

if [ "$HTTP_STATUS" == "200" ]; then
    echo "✅ Dashboard Query (UUID): PASSED (200 OK)"
elif [ "$HTTP_STATUS" == "404" ]; then
    echo "✅ Dashboard Query (UUID): PASSED (404 Not Found - Expected if UUID doesn't exist, but no 500!)"
else
    echo "❌ Dashboard Query (UUID): FAILED (Status: $HTTP_STATUS)"
    echo "Response: $BODY"
fi

# 2. Test CORS Preflight with UUID
echo "🔍 Testing CORS Preflight for Heatmaps with UUID..."
CORS_RESP=$(curl -s -i -X OPTIONS "$API_URL/api/v1/heatmaps/record" \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type, X-Site-ID")

if [[ $CORS_RESP == *"Access-Control-Allow-Origin: http://localhost:3000"* ]]; then
    echo "✅ CORS Preflight: PASSED"
else
    echo "❌ CORS Preflight: FAILED"
    echo "Response: $CORS_RESP"
fi

echo "---------------------------------------"
echo "🏁 Verification Completed!"
