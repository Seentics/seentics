#!/bin/bash

# MaxMind GeoIP2 Database Setup Script
# This script downloads and sets up the MaxMind GeoLite2 database for IP geolocation

set -e

echo "🌍 Setting up MaxMind GeoIP2 Database..."

# Create data directory
mkdir -p /data

# Check if MaxMind license key is provided
if [ -z "$MAXMIND_LICENSE_KEY" ]; then
    echo "⚠️  MAXMIND_LICENSE_KEY environment variable not set."
    echo "   You can get a free license key from: https://www.maxmind.com/en/geolite2/signup"
    echo "   For now, using fallback to free API services."
    exit 0
fi

# Download GeoLite2 City database
echo "📥 Downloading GeoLite2-City database..."
curl -L "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz" \
    -o /tmp/GeoLite2-City.tar.gz

# Extract the database
echo "📦 Extracting database..."
cd /tmp
tar -xzf GeoLite2-City.tar.gz

# Find and move the .mmdb file
MMDB_FILE=$(find . -name "GeoLite2-City.mmdb" | head -1)
if [ -n "$MMDB_FILE" ]; then
    mv "$MMDB_FILE" /data/GeoLite2-City.mmdb
    echo "✅ MaxMind database installed at /data/GeoLite2-City.mmdb"
else
    echo "❌ Failed to find GeoLite2-City.mmdb file"
    exit 1
fi

# Clean up
rm -rf /tmp/GeoLite2-City*

# Set permissions
chmod 644 /data/GeoLite2-City.mmdb

echo "🎉 MaxMind GeoIP2 setup complete!"
echo "   Database path: /data/GeoLite2-City.mmdb"
echo "   Set MAXMIND_DB_PATH environment variable to use custom path"
