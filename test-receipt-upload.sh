#!/bin/bash
# Test Receipt Upload API
# Usage: ./test-receipt-upload.sh <projectId> <imagePath> [category] [notes]

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./test-receipt-upload.sh <projectId> <imagePath> [category] [notes]"
  echo ""
  echo "Example:"
  echo "  ./test-receipt-upload.sh 65 receipt.jpg materials \"Lumber purchase\""
  echo ""
  echo "Categories: materials, labor, equipment, other"
  exit 1
fi

PROJECT_ID=$1
IMAGE_PATH=$2
CATEGORY=${3:-""}
NOTES=${4:-""}

# Check if image file exists
if [ ! -f "$IMAGE_PATH" ]; then
  echo "Error: Image file not found: $IMAGE_PATH"
  exit 1
fi

API_KEY="kolmo_3745831a1928c3ed7bc7ffe449592067ade876f86f59ff6a4b12cb0519d95aaa"
BASE_URL="https://www.kolmo.design"

echo "========================================="
echo "Testing Receipt Upload API"
echo "========================================="
echo "Project ID: $PROJECT_ID"
echo "Image: $IMAGE_PATH"
echo "Category: ${CATEGORY:-"(none)"}"
echo "Notes: ${NOTES:-"(none)"}"
echo ""
echo "Uploading..."
echo ""

# Build curl command
CURL_CMD="curl -X POST \"$BASE_URL/api/projects/$PROJECT_ID/receipts\" \
  -H \"Authorization: Bearer $API_KEY\" \
  -F \"file=@$IMAGE_PATH\""

if [ -n "$CATEGORY" ]; then
  CURL_CMD="$CURL_CMD -F \"category=$CATEGORY\""
fi

if [ -n "$NOTES" ]; then
  CURL_CMD="$CURL_CMD -F \"notes=$NOTES\""
fi

# Execute upload
RESPONSE=$(eval $CURL_CMD)

# Parse response
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo "✅ Upload successful!"

  # Extract OCR details
  VENDOR=$(echo "$RESPONSE" | jq -r '.receipt.vendorName // "N/A"')
  AMOUNT=$(echo "$RESPONSE" | jq -r '.receipt.totalAmount // "N/A"')
  CONFIDENCE=$(echo "$RESPONSE" | jq -r '.ocr.confidence // "N/A"')

  echo ""
  echo "OCR Results:"
  echo "  Vendor: $VENDOR"
  echo "  Amount: \$$AMOUNT"
  echo "  Confidence: $CONFIDENCE%"
else
  echo ""
  echo "❌ Upload failed!"
fi
