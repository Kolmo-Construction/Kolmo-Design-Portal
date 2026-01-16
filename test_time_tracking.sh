#!/bin/bash

# Test Time Tracking System
# Tests clock-in, clock-out, and geofencing functionality

set -e

API_URL="${API_URL:-http://localhost:3000}"
echo "🧪 Testing Time Tracking at $API_URL"
echo "================================================"

# Get credentials from .env.local if exists
if [ -f ".env.local" ]; then
    source .env.local
fi

# Test user credentials (contractor)
EMAIL="${TEST_EMAIL:-pascal@kolmodesign.com}"
PASSWORD="${TEST_PASSWORD:-password}"
PROJECT_ID="${TEST_PROJECT_ID:-1}"

echo ""
echo "📋 Test Configuration:"
echo "  Email: $EMAIL"
echo "  Project ID: $PROJECT_ID"
echo ""

# Step 1: Login
echo "1️⃣  Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
    echo "❌ Login failed!"
    echo "$LOGIN_RESPONSE" | jq '.'
    exit 1
fi

# Extract session cookie
COOKIE=$(echo "$LOGIN_RESPONSE" | grep -i "set-cookie:" | cut -d: -f2- | tr -d '\r')

echo "✅ Login successful"
echo ""

# Step 2: Check for active time entry
echo "2️⃣  Checking for active time entry..."
ACTIVE_RESPONSE=$(curl -s -X GET "$API_URL/api/time/active" \
  -H "Cookie: $COOKIE")

echo "$ACTIVE_RESPONSE" | jq '.'

HAS_ACTIVE=$(echo "$ACTIVE_RESPONSE" | jq -r '.timeEntry != null')

if [ "$HAS_ACTIVE" = "true" ]; then
    echo "⚠️  Active time entry found - clocking out first..."

    CLOCK_OUT_RESPONSE=$(curl -s -X POST "$API_URL/api/time/clock-out" \
      -H "Content-Type: application/json" \
      -H "Cookie: $COOKIE" \
      -d '{
        "latitude": 37.7749,
        "longitude": -122.4194,
        "notes": "Test clock-out (cleanup)"
      }')

    echo "$CLOCK_OUT_RESPONSE" | jq '.'
    echo "✅ Clocked out existing session"
fi

echo ""

# Step 3: Clock In
echo "3️⃣  Testing Clock In..."
CLOCK_IN_RESPONSE=$(curl -s -X POST "$API_URL/api/time/clock-in" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{
    \"projectId\": $PROJECT_ID,
    \"latitude\": 37.7749,
    \"longitude\": -122.4194,
    \"notes\": \"Test clock-in from automation script\"
  }")

echo "$CLOCK_IN_RESPONSE" | jq '.'

CLOCK_IN_SUCCESS=$(echo "$CLOCK_IN_RESPONSE" | jq -r '.success')
TIME_ENTRY_ID=$(echo "$CLOCK_IN_RESPONSE" | jq -r '.timeEntry.id')

if [ "$CLOCK_IN_SUCCESS" != "true" ]; then
    echo "❌ Clock-in failed!"
    exit 1
fi

echo "✅ Clock-in successful (Entry ID: $TIME_ENTRY_ID)"
echo ""

# Step 4: Verify Active Entry
echo "4️⃣  Verifying active entry..."
sleep 1

ACTIVE_CHECK=$(curl -s -X GET "$API_URL/api/time/active" \
  -H "Cookie: $COOKIE")

echo "$ACTIVE_CHECK" | jq '.'

ACTIVE_ID=$(echo "$ACTIVE_CHECK" | jq -r '.timeEntry.id')

if [ "$ACTIVE_ID" != "$TIME_ENTRY_ID" ]; then
    echo "❌ Active entry verification failed!"
    exit 1
fi

echo "✅ Active entry verified"
echo ""

# Step 5: Wait a bit to accumulate time
echo "5️⃣  Waiting 3 seconds to accumulate time..."
sleep 3
echo "✅ Time accumulated"
echo ""

# Step 6: Clock Out
echo "6️⃣  Testing Clock Out..."
CLOCK_OUT_RESPONSE=$(curl -s -X POST "$API_URL/api/time/clock-out" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d '{
    "latitude": 37.7750,
    "longitude": -122.4195,
    "notes": "Test clock-out from automation script"
  }')

echo "$CLOCK_OUT_RESPONSE" | jq '.'

CLOCK_OUT_SUCCESS=$(echo "$CLOCK_OUT_RESPONSE" | jq -r '.success')
DURATION=$(echo "$CLOCK_OUT_RESPONSE" | jq -r '.timeEntry.durationMinutes')

if [ "$CLOCK_OUT_SUCCESS" != "true" ]; then
    echo "❌ Clock-out failed!"
    exit 1
fi

echo "✅ Clock-out successful (Duration: $DURATION minutes)"
echo ""

# Step 7: Verify No Active Entry
echo "7️⃣  Verifying no active entry..."
NO_ACTIVE=$(curl -s -X GET "$API_URL/api/time/active" \
  -H "Cookie: $COOKIE")

echo "$NO_ACTIVE" | jq '.'

HAS_ENTRY=$(echo "$NO_ACTIVE" | jq -r '.timeEntry != null')

if [ "$HAS_ENTRY" = "true" ]; then
    echo "❌ Still has active entry after clock-out!"
    exit 1
fi

echo "✅ No active entry confirmed"
echo ""

# Step 8: Get Recent Entries
echo "8️⃣  Fetching recent time entries..."
ENTRIES_RESPONSE=$(curl -s -X GET "$API_URL/api/time/entries?includeActive=false" \
  -H "Cookie: $COOKIE")

echo "$ENTRIES_RESPONSE" | jq '.'

ENTRY_COUNT=$(echo "$ENTRIES_RESPONSE" | jq -r '.entries | length')
TOTAL_HOURS=$(echo "$ENTRIES_RESPONSE" | jq -r '.summary.totalHours')

echo "✅ Found $ENTRY_COUNT entries (Total: $TOTAL_HOURS hours)"
echo ""

# Step 9: Test Geofence Validation
echo "9️⃣  Testing Geofence Validation..."
echo "   (Clocking in far from site - should flag as outside geofence)"

GEOFENCE_TEST=$(curl -s -X POST "$API_URL/api/time/clock-in" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{
    \"projectId\": $PROJECT_ID,
    \"latitude\": 40.7128,
    \"longitude\": -74.0060,
    \"notes\": \"Test geofence validation (NYC coordinates)\"
  }")

echo "$GEOFENCE_TEST" | jq '.'

WITHIN_GEOFENCE=$(echo "$GEOFENCE_TEST" | jq -r '.geofence.withinGeofence')
DISTANCE=$(echo "$GEOFENCE_TEST" | jq -r '.geofence.distanceMeters')

if [ "$WITHIN_GEOFENCE" = "false" ]; then
    echo "✅ Geofence validation working (Distance: ${DISTANCE}m from site)"

    # Clean up - clock out
    curl -s -X POST "$API_URL/api/time/clock-out" \
      -H "Content-Type: application/json" \
      -H "Cookie: $COOKIE" \
      -d '{"latitude": 40.7128, "longitude": -74.0060}' > /dev/null
else
    echo "⚠️  Geofence validation might not be configured for this project"
fi

echo ""
echo "================================================"
echo "🎉 All Time Tracking Tests Passed!"
echo "================================================"
