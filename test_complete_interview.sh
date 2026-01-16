#!/bin/bash

# Complete Interview Flow Test - Create a Full Quote
# Tests the entire flow from start to quote creation

API_URL="http://localhost:3000"
USERNAME="admin"
PASSWORD="admin123"

echo "🎯 Complete Interview & Quote Generation Test"
echo "=============================================="
echo ""

# Step 1: Login
echo "📝 Step 1: Logging in"
curl -s -X POST "$API_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" \
  -c /tmp/kolmo_final.txt > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Login successful"
else
  echo "❌ Login failed"
  exit 1
fi

echo ""

# Step 2: Start Interview
echo "📝 Step 2: Starting interview"
START_RESPONSE=$(curl -s -X POST "$API_URL/api/interview/start" \
  -H "Content-Type: application/json" \
  -d '{"leadId": null}' \
  -b /tmp/kolmo_final.txt)

SESSION_ID=$(echo "$START_RESPONSE" | grep -o '"sessionId":[0-9]*' | grep -o '[0-9]*')
echo "✅ Session started: $SESSION_ID"
echo ""

# Function to submit a turn and show response
submit_turn() {
  local input="$1"
  local description="$2"

  echo "💬 $description"
  echo "   Input: \"$input\""

  RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/turn" \
    -H "Content-Type: application/json" \
    -d "{\"input\": \"$input\"}" \
    -b /tmp/kolmo_final.txt)

  PROGRESS=$(echo "$RESPONSE" | grep -o '"percentComplete":[0-9]*' | grep -o '[0-9]*')
  COMPLETE=$(echo "$RESPONSE" | grep -o '"isComplete":[a-z]*' | grep -o '[a-z]*')

  echo "   Progress: $PROGRESS%"

  if [ "$COMPLETE" = "true" ]; then
    echo "   ✅ Interview COMPLETE!"
    return 1
  fi

  sleep 1
  echo ""
  return 0
}

# Step 3: Answer all required fields
echo "📋 Step 3: Collecting Information"
echo "=================================="
echo ""

submit_turn "Jane Smith" "Customer Name"
submit_turn "jane.smith@example.com" "Customer Email"
submit_turn "555-1234" "Customer Phone"
submit_turn "123 Main Street, Springfield" "Customer Address"
submit_turn "Kitchen Remodel" "Project Type"
submit_turn "First floor kitchen" "Location"
submit_turn "Complete kitchen renovation including new cabinets, countertops, appliances, and flooring. Approximately 200 sq ft." "Scope Description"
submit_turn "\$45,000" "Estimated Budget"
submit_turn "40" "Down Payment Percentage"
submit_turn "March 15, 2025" "Estimated Start Date"
submit_turn "May 30, 2025" "Estimated Completion Date"
submit_turn "60 days" "Valid Until"

echo "📦 Step 4: Adding Line Items"
echo "============================="
echo ""

submit_turn "Custom oak cabinets, 20 linear feet at \$400 per foot" "Line Item 1"
submit_turn "Granite countertops, 50 sq ft at \$80 per sq ft" "Line Item 2"
submit_turn "Stainless steel appliance package" "Line Item 3"
submit_turn "Porcelain tile flooring, 200 sq ft at \$15 per sq ft" "Line Item 4"
submit_turn "done" "Finish Line Items"

echo ""
echo "📄 Step 5: Creating Quote"
echo "=========================="
echo ""

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/interview/$SESSION_ID/create-quote" \
  -H "Content-Type: application/json" \
  -b /tmp/kolmo_final.txt)

echo "$CREATE_RESPONSE"

QUOTE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')

if [ -n "$QUOTE_ID" ]; then
  echo ""
  echo "✅ Quote created successfully!"
  echo "   Quote ID: $QUOTE_ID"
  echo ""

  # Step 6: Verify quote in database
  echo "🔍 Step 6: Verifying quote in database"
  echo "======================================"
  echo ""

  psql "${DATABASE_URL:-postgresql://pascalmatta@localhost:5432/kolmo_local}" -c "
    SELECT
      id,
      customer_name,
      customer_email,
      estimated_budget,
      status,
      created_at
    FROM quotes
    WHERE id = $QUOTE_ID;
  "

  echo ""
  echo "📋 Line Items:"
  psql "${DATABASE_URL:-postgresql://pascalmatta@localhost:5432/kolmo_local}" -c "
    SELECT
      description,
      quantity,
      unit,
      unit_price,
      total_price
    FROM quote_line_items
    WHERE quote_id = $QUOTE_ID;
  "

else
  echo "❌ Failed to create quote"
  echo "Response: $CREATE_RESPONSE"
fi

echo ""
echo "=========================================="
echo "🎉 Test Complete!"
echo ""
echo "🧹 Cleanup:"
rm -f /tmp/kolmo_final.txt
echo "  • Removed temporary cookies"
