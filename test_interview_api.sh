#!/bin/bash

# Simple test of Interview API
# Make sure the server is running first!

API_URL="http://localhost:5000"

echo "🧪 Testing Interview API..."
echo ""

# Test 1: Start session (will fail if not authenticated, which is expected)
echo "1. Testing POST /api/interview/start"
curl -X POST "$API_URL/api/interview/start" \
  -H "Content-Type: application/json" \
  -d '{"leadId": null}' \
  -w "\nStatus: %{http_code}\n" \
  2>/dev/null

echo ""
echo "✅ If you got 401 Unauthorized, that's correct! The API is working and requires auth."
echo ""
echo "To properly test, you'll need to:"
echo "  1. Log in through the web app to get a session"
echo "  2. Or create an API key for a PM/Admin user"
echo "  3. Then use that session/key to test the interview endpoints"
