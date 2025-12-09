#!/bin/bash
# Test Mobile Login API
# Usage: ./test-mobile-login.sh <email> <password>

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./test-mobile-login.sh <email> <password>"
  echo ""
  echo "Example:"
  echo "  ./test-mobile-login.sh admin@kolmo.design password123"
  exit 1
fi

EMAIL=$1
PASSWORD=$2
BASE_URL=${BASE_URL:-"https://www.kolmo.design"}

echo "========================================="
echo "Testing Mobile Login API"
echo "========================================="
echo "Email: $EMAIL"
echo "Base URL: $BASE_URL"
echo ""
echo "Logging in..."
echo ""

# Make login request
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

# Parse response
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Check if successful and extract API key
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo "✅ Login successful!"

  # Extract user info
  USER_ID=$(echo "$RESPONSE" | jq -r '.user.id // "N/A"')
  FIRST_NAME=$(echo "$RESPONSE" | jq -r '.user.firstName // "N/A"')
  LAST_NAME=$(echo "$RESPONSE" | jq -r '.user.lastName // "N/A"')
  ROLE=$(echo "$RESPONSE" | jq -r '.user.role // "N/A"')
  API_KEY=$(echo "$RESPONSE" | jq -r '.apiKey // "N/A"')

  echo ""
  echo "User Information:"
  echo "  ID: $USER_ID"
  echo "  Name: $FIRST_NAME $LAST_NAME"
  echo "  Role: $ROLE"
  echo ""
  echo "API Key:"
  echo "  $API_KEY"
  echo ""
  echo "You can now use this API key for mobile app requests:"
  echo "  Authorization: Bearer $API_KEY"
  echo ""

  # Test the API key with a simple request
  echo "Testing API key with /api/auth/me..."
  ME_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/me" \
    -H "Authorization: Bearer $API_KEY")

  echo "$ME_RESPONSE" | jq . 2>/dev/null || echo "$ME_RESPONSE"

  if echo "$ME_RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "✅ API key is working!"
  else
    echo ""
    echo "⚠️  API key validation failed"
  fi
else
  echo ""
  echo "❌ Login failed!"
  ERROR=$(echo "$RESPONSE" | jq -r '.message // "Unknown error"')
  echo "Error: $ERROR"
fi
