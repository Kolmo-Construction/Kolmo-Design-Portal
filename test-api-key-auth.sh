#!/bin/bash
# Test API Key Authentication
# Usage: ./test-api-key-auth.sh <your-api-key>

if [ -z "$1" ]; then
  echo "Usage: ./test-api-key-auth.sh <your-api-key>"
  echo "Example: ./test-api-key-auth.sh kolmo_abc123..."
  exit 1
fi

API_KEY=$1
BASE_URL="https://www.kolmo.design"

echo "Testing API Key Authentication..."
echo "API Key: ${API_KEY:0:15}..."
echo ""

# Test with Bearer token (preferred method)
echo "1. Testing with Bearer token format:"
curl -v \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/projects" \
  2>&1 | grep -E "(< HTTP|Authorization|api-key|Unauthorized|projects)"

echo ""
echo "2. Testing with X-API-Key header:"
curl -v \
  -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/projects" \
  2>&1 | grep -E "(< HTTP|X-API-Key|Unauthorized|projects)"
