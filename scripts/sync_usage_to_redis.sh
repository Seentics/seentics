#!/bin/bash
# Sync current database counts to Redis

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default password if not set
REDIS_PASS="${REDIS_PASSWORD:-redis123}"

echo "Syncing current usage counts from PostgreSQL to Redis..."

# Get all users and their current counts
docker exec postgres psql -U seentics -d seentics_analytics -t -c "
SELECT 
    user_id::text,
    'websites',
    COUNT(*)
FROM websites 
WHERE is_active = true 
GROUP BY user_id

UNION ALL

SELECT 
    user_id,
    'funnels',
    COUNT(*)
FROM funnels 
WHERE is_active = true 
GROUP BY user_id

UNION ALL

SELECT 
    user_id,
    'automations',
    COUNT(*)
FROM automations 
WHERE is_active = true 
GROUP BY user_id
UNION ALL

SELECT 
    w.user_id::text,
    'monthly_events',
    COUNT(*)
FROM events e
JOIN websites w ON e.website_id = w.site_id
WHERE e.timestamp >= date_trunc('month', CURRENT_DATE)
GROUP BY w.user_id;
" | while IFS='|' read -r user_id resource_type count; do
    # Trim whitespace
    user_id=$(echo "$user_id" | tr -d ' ')
    resource_type=$(echo "$resource_type" | tr -d ' ')
    count=$(echo "$count" | tr -d ' ')
    
    if [ -n "$user_id" ] && [ -n "$resource_type" ] && [ -n "$count" ]; then
        echo "Setting usage:$user_id:$resource_type = $count"
        docker exec redis redis-cli -a "$REDIS_PASS" --no-auth-warning SET "usage:$user_id:$resource_type" "$count"
    fi
done

echo "✓ Sync complete! Redis now contains current usage counts."
echo ""
echo "Verifying Redis keys:"
docker exec redis redis-cli -a "$REDIS_PASS" --no-auth-warning KEYS "usage:*" | head -20
