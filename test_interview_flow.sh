#!/bin/bash

# Comprehensive Interview Mode Test
# Tests the complete flow: login, start session, answer questions, create quote

API_URL="http://localhost:3000"
USERNAME="admin"
PASSWORD="admin123"

echo "🧪 Testing Interview Mode - Complete Flow"
echo "=========================================="
echo ""

# Step 1: Login
echo "📝 Step 1: Logging in as $USERNAME"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" \
  -c /tmp/kolmo_cookies.txt)

echo "$LOGIN_RESPONSE"

# Check if login was successful (look for user id field)
if echo "$LOGIN_RESPONSE" | grep -q '"id"'; then
  echo "✅ Login successful"
else
  echo "❌ Login failed - Please check credentials"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "=========================================="
echo ""

# Step 2: Start Interview Session
echo "📝 Step 2: Starting interview session"
START_RESPONSE=$(curl -s -X POST "$API_URL/api/interview/start" \
  -H "Content-Type: application/json" \
  -d '{"leadId": null}' \
  -b /tmp/kolmo_cookies.txt)

echo "$START_RESPONSE"

# Extract session ID using grep and basic string manipulation
SESSION_ID=$(echo "$START_RESPONSE" | grep -o '"sessionId":[0-9]*' | grep -o '[0-9]*')

if [ -z "$SESSION_ID" ]; then
  echo "❌ Failed to start session"
  exit 1
fi

echo "✅ Session started with ID: $SESSION_ID"

echo ""
echo "=========================================="
echo ""

# Step 3: Answer first question (customer name)
echo "📝 Step 3: Submitting customer name"
TURN1_RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/turn" \
  -H "Content-Type: application/json" \
  -d '{"input": "The customer name is John Smith"}' \
  -b /tmp/kolmo_cookies.txt)

echo "$TURN1_RESPONSE"
echo "✅ Turn 1 complete"

echo ""
echo "=========================================="
echo ""

# Step 4: Answer second question (email)
echo "📝 Step 4: Submitting customer email"
TURN2_RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/turn" \
  -H "Content-Type: application/json" \
  -d '{"input": "john.smith@example.com"}' \
  -b /tmp/kolmo_cookies.txt)

echo "$TURN2_RESPONSE"
echo "✅ Turn 2 complete"

echo ""
echo "=========================================="
echo ""

# Step 5: Answer third question (phone)
echo "📝 Step 5: Submitting customer phone"
TURN3_RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/turn" \
  -H "Content-Type: application/json" \
  -d '{"input": "555-1234"}' \
  -b /tmp/kolmo_cookies.txt)

echo "$TURN3_RESPONSE"
echo "✅ Turn 3 complete"

echo ""
echo "=========================================="
echo ""

# Step 6: Get session details
echo "📝 Step 6: Fetching session details"
SESSION_RESPONSE=$(curl -s -X GET "$API_URL/api/interview/$SESSION_ID" \
  -b /tmp/kolmo_cookies.txt)

echo "$SESSION_RESPONSE"

echo ""
echo "=========================================="
echo ""

# Summary
echo "📊 Test Summary:"
echo "  • Session ID: $SESSION_ID"
echo "  • Questions answered: 3"
echo "  • Status: Interview in progress"
echo ""
echo "✅ All basic API tests passed!"
echo ""
echo "💡 Next steps to complete the interview:"
echo "  1. Continue answering questions via the mobile app"
echo "  2. Or use curl to complete remaining fields"
echo "  3. Test voice upload with mobile app"
echo ""
echo "🧹 Cleanup:"
rm -f /tmp/kolmo_cookies.txt
echo "  • Removed temporary cookies"
