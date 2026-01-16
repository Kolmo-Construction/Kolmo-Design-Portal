#!/bin/bash

# Test Non-Linear Interview Capabilities
# Tests: corrections, multi-fact extraction, scope changes

API_URL="http://localhost:3000"
USERNAME="admin"
PASSWORD="admin123"

echo "🧪 Testing Non-Linear Interview Capabilities"
echo "=============================================="
echo ""

# Step 1: Login
echo "📝 Step 1: Logging in"
curl -s -X POST "$API_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" \
  -c /tmp/kolmo_cookies2.txt > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Login successful"
else
  echo "❌ Login failed"
  exit 1
fi

echo ""
echo "=========================================="
echo ""

# Step 2: Start new session
echo "📝 Step 2: Starting interview session"
START_RESPONSE=$(curl -s -X POST "$API_URL/api/interview/start" \
  -H "Content-Type: application/json" \
  -d '{"leadId": null}' \
  -b /tmp/kolmo_cookies2.txt)

SESSION_ID=$(echo "$START_RESPONSE" | grep -o '"sessionId":[0-9]*' | grep -o '[0-9]*')

if [ -z "$SESSION_ID" ]; then
  echo "❌ Failed to start session"
  echo "$START_RESPONSE"
  exit 1
fi

echo "✅ Session started: $SESSION_ID"
echo ""
echo "=========================================="
echo ""

# Test 1: Normal answer
echo "🎯 Test 1: Normal Answer"
echo "Input: 'John Smith'"
RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/turn" \
  -H "Content-Type: application/json" \
  -d '{"input": "John Smith"}' \
  -b /tmp/kolmo_cookies2.txt)

echo "$RESPONSE" | grep -o '"customerName":"[^"]*"' || echo "Response: $RESPONSE"
echo ""
sleep 1

# Test 2: Multi-fact extraction
echo "🎯 Test 2: Multi-Fact Extraction"
echo "Input: 'The email is john@example.com and phone is 555-1234'"
RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/turn" \
  -H "Content-Type: application/json" \
  -d '{"input": "The email is john@example.com and phone is 555-1234"}' \
  -b /tmp/kolmo_cookies2.txt)

echo "$RESPONSE" | grep -o '"customerEmail":"[^"]*"' || echo "(checking email)"
echo "$RESPONSE" | grep -o '"customerPhone":"[^"]*"' || echo "(checking phone)"
echo ""
sleep 1

# Test 3: Correction/Modification
echo "🎯 Test 3: Correction (MODIFY Intent)"
echo "Input: 'Actually, change the customer name to Jane Smith'"
RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/turn" \
  -H "Content-Type: application/json" \
  -d '{"input": "Actually, change the customer name to Jane Smith"}' \
  -b /tmp/kolmo_cookies2.txt)

echo "$RESPONSE" | grep -o '"customerName":"[^"]*"' || echo "Response: $RESPONSE"
echo "Expected: customerName should now be 'Jane Smith'"
echo ""
sleep 1

# Test 4: Project description with multiple facts
echo "🎯 Test 4: Complex Multi-Fact"
echo "Input: '123 Main St, and it is a 12x12 Cedar Deck project'"
RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/turn" \
  -H "Content-Type: application/json" \
  -d '{"input": "123 Main St, and it is a 12x12 Cedar Deck project"}' \
  -b /tmp/kolmo_cookies2.txt)

echo "Extracted fields:"
echo "$RESPONSE" | grep -o '"customerAddress":"[^"]*"' || echo "(no address)"
echo "$RESPONSE" | grep -o '"projectType":"[^"]*"' || echo "(no projectType)"
echo "$RESPONSE" | grep -o '"scopeDescription":"[^"]*"' || echo "(no scope)"
echo ""

echo "=========================================="
echo ""
echo "📊 Test Summary:"
echo "  • Session ID: $SESSION_ID"
echo "  • Tests run: 4"
echo "  • Capabilities tested:"
echo "    - Normal answering"
echo "    - Multi-fact extraction (2 fields at once)"
echo "    - Corrections/modifications (MODIFY intent)"
echo "    - Complex multi-fact (3+ fields)"
echo ""
echo "✅ Non-linear interview tests complete!"
echo ""
echo "🧹 Cleanup:"
rm -f /tmp/kolmo_cookies2.txt
echo "  • Removed temporary cookies"
