# Mobile App Receipt Management API

## Overview
The receipt management system allows mobile users to upload receipt images, which are automatically processed with OCR (Optical Character Recognition) using Taggun to extract vendor names, amounts, dates, and other details.

---

## 📱 Receipt Upload - Expected Format

### Endpoint
```
POST /api/projects/{projectId}/receipts
```

### Authentication
```http
Authorization: Bearer kolmo_3745831a1928c3ed7bc7ffe449592067ade876f86f59ff6a4b12cb0519d95aaa
```

### Request Format
**Content-Type:** `multipart/form-data`

### Form Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ Yes | Receipt image (JPG, PNG, PDF) - Max 10MB |
| `category` | String | ❌ Optional | `materials`, `labor`, `equipment`, or `other` |
| `notes` | String | ❌ Optional | Additional notes about the receipt |

### Supported File Types
- ✅ JPG/JPEG images
- ✅ PNG images
- ✅ PDF documents
- ❌ Max file size: 10MB

---

## 🚀 Example API Calls

### Using cURL
```bash
curl -X POST "https://www.kolmo.design/api/projects/65/receipts" \
  -H "Authorization: Bearer kolmo_3745831a1928c3ed7bc7ffe449592067ade876f86f59ff6a4b12cb0519d95aaa" \
  -F "file=@receipt.jpg" \
  -F "category=materials" \
  -F "notes=Lumber purchase from Home Depot"
```

### Using JavaScript/TypeScript (React Native)
```javascript
const uploadReceipt = async (projectId, imageUri, category, notes) => {
  const formData = new FormData();

  // Add the image file
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',  // or 'image/png'
    name: 'receipt.jpg'
  });

  // Add optional fields
  if (category) {
    formData.append('category', category);
  }
  if (notes) {
    formData.append('notes', notes);
  }

  try {
    const response = await fetch(
      `https://www.kolmo.design/api/projects/${projectId}/receipts`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer kolmo_3745831a1928c3ed7bc7ffe449592067ade876f86f59ff6a4b12cb0519d95aaa',
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('Receipt uploaded:', result.receipt);
      console.log('OCR results:', result.ocr);
      return result;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

// Usage
await uploadReceipt(65, 'file:///path/to/image.jpg', 'materials', 'Lumber purchase');
```

### Using Axios
```javascript
import axios from 'axios';
import FormData from 'form-data';

const uploadReceipt = async (projectId, filePath, category, notes) => {
  const formData = new FormData();
  formData.append('file', {
    uri: filePath,
    type: 'image/jpeg',
    name: 'receipt.jpg'
  });

  if (category) formData.append('category', category);
  if (notes) formData.append('notes', notes);

  const response = await axios.post(
    `https://www.kolmo.design/api/projects/${projectId}/receipts`,
    formData,
    {
      headers: {
        'Authorization': 'Bearer kolmo_3745831a1928c3ed7bc7ffe449592067ade876f86f59ff6a4b12cb0519d95aaa',
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
};
```

---

## 📥 Success Response (201 Created)

```json
{
  "success": true,
  "message": "Receipt uploaded successfully",
  "receipt": {
    "id": 123,
    "projectId": 65,
    "uploadedBy": 1,
    "vendorName": "Home Depot",
    "totalAmount": "456.78",
    "currency": "USD",
    "receiptDate": "2025-12-08T10:30:00.000Z",
    "category": "materials",
    "tags": [],
    "notes": "Lumber purchase from Home Depot",
    "imageUrl": "https://your-r2-bucket.com/receipts/project-65/receipt-123.jpg",
    "imageKey": "receipts/project-65/receipt-123.jpg",
    "ocrData": { /* Full Taggun response */ },
    "ocrConfidence": "95.5",
    "ocrProcessedAt": "2025-12-08T18:45:00.000Z",
    "isVerified": false,
    "verifiedBy": null,
    "verifiedAt": null,
    "createdAt": "2025-12-08T18:45:00.000Z",
    "updatedAt": "2025-12-08T18:45:00.000Z",
    "uploader": {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    }
  },
  "ocr": {
    "success": true,
    "confidence": 95.5,
    "error": null
  }
}
```

### OCR Extracted Fields
The Taggun OCR service attempts to extract:
- ✅ **Vendor name** - Business name from receipt
- ✅ **Total amount** - Total purchase amount
- ✅ **Currency** - Currency code (USD, EUR, etc.)
- ✅ **Receipt date** - Date of purchase
- ✅ **Line items** - Individual items purchased (if available)
- ✅ **Confidence score** - OCR accuracy percentage

---

## ❌ Error Responses

### 400 Bad Request - No File
```json
{
  "success": false,
  "message": "No file uploaded"
}
```

### 400 Bad Request - Invalid Project ID
```json
{
  "success": false,
  "message": "Invalid project ID"
}
```

### 401 Unauthorized - Missing/Invalid API Key
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### 413 Payload Too Large - File Size Exceeded
```json
{
  "success": false,
  "message": "File too large"
}
```

### 415 Unsupported Media Type - Wrong File Type
```json
{
  "success": false,
  "message": "Only image files and PDFs are allowed"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error while uploading receipt"
}
```

---

## 🔄 Complete E2E Flow

### 1. Mobile App: User Takes Photo
```
User opens camera → Captures receipt → App prepares upload
```

### 2. Mobile App: Upload Receipt
```javascript
POST /api/projects/{projectId}/receipts
- Headers: Authorization with API key
- Body: multipart/form-data with image file
```

### 3. Server: Receive & Validate
```
✓ Validate API key
✓ Check user has access to project
✓ Validate file type and size
✓ Check projectId exists
```

### 4. Server: Upload to Cloud Storage (R2)
```
✓ Upload image to Cloudflare R2 bucket
✓ Generate secure URL
✓ Store image key for future reference
```

### 5. Server: OCR Processing (Taggun)
```
✓ Send image to Taggun API
✓ Extract vendor name, amount, date
✓ Calculate confidence score
✓ Handle OCR failures gracefully
```

### 6. Server: Save to Database
```
✓ Create receipt record in PostgreSQL
✓ Store OCR data as JSONB
✓ Link to project and uploader
✓ Set initial verification status (false)
```

### 7. Server: Return Response
```
✓ Return complete receipt object
✓ Include OCR results
✓ Include image URL for display
```

### 8. Mobile App: Display Result
```
✓ Show receipt details
✓ Display extracted vendor/amount
✓ Allow user to edit if OCR incorrect
✓ Show image thumbnail
```

### 9. Admin/PM: Review & Verify (Web Portal)
```
✓ View all uploaded receipts
✓ Verify OCR accuracy
✓ Approve/edit expense data
✓ Mark as verified
```

### 10. Financial Reporting
```
✓ Generate expense summaries
✓ Track spending by category
✓ Export for accounting
```

---

## 🔍 Other Receipt Endpoints

### Get All Receipts for a Project
```bash
GET /api/projects/{projectId}/receipts
Authorization: Bearer {api-key}

# Optional query parameters:
?startDate=2025-01-01
&endDate=2025-12-31
&category=materials
&isVerified=true
```

### Get Single Receipt
```bash
GET /api/receipts/{receiptId}
Authorization: Bearer {api-key}
```

### Update Receipt Details
```bash
PATCH /api/receipts/{receiptId}
Authorization: Bearer {api-key}
Content-Type: application/json

{
  "vendorName": "Corrected Vendor Name",
  "totalAmount": 123.45,
  "receiptDate": "2025-12-08",
  "category": "materials",
  "notes": "Updated notes"
}
```

### Delete Receipt
```bash
DELETE /api/receipts/{receiptId}
Authorization: Bearer {api-key}
```

### Get Expense Summary
```bash
GET /api/projects/{projectId}/expenses
Authorization: Bearer {api-key}

# Returns totals by category, vendor, verification status
```

---

## 🎯 Best Practices for Mobile App

### 1. Image Quality
- ✅ Use high-resolution camera (min 2MP)
- ✅ Ensure good lighting
- ✅ Keep receipt flat and in focus
- ✅ Capture entire receipt including edges

### 2. Error Handling
```javascript
try {
  const result = await uploadReceipt(projectId, imageUri, category, notes);

  // Check OCR success
  if (!result.ocr.success) {
    // Warn user OCR failed, but receipt is saved
    showWarning('Receipt saved, but automatic reading failed. Please verify details.');
  }

  // Show success
  showSuccess('Receipt uploaded successfully!');

} catch (error) {
  if (error.response?.status === 401) {
    showError('Please log in again');
  } else if (error.response?.status === 413) {
    showError('Image too large. Please compress or take new photo.');
  } else {
    showError('Upload failed. Please try again.');
  }
}
```

### 3. Offline Support
```javascript
// Queue receipts when offline
if (!isOnline) {
  await queueReceiptForUpload(projectId, imageUri, category, notes);
  showInfo('Receipt queued. Will upload when online.');
  return;
}

// Process queue when back online
onNetworkReconnect(async () => {
  const queue = await getPendingReceipts();
  for (const receipt of queue) {
    await uploadReceipt(receipt.projectId, receipt.imageUri, receipt.category, receipt.notes);
  }
});
```

### 4. Progress Indicators
```javascript
// Show upload progress
const uploadWithProgress = async (projectId, imageUri, category, notes) => {
  showProgress(0);

  try {
    const formData = new FormData();
    // ... add fields

    const response = await axios.post(url, formData, {
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        showProgress(percentCompleted);
      }
    });

    hideProgress();
    return response.data;
  } catch (error) {
    hideProgress();
    throw error;
  }
};
```

### 5. Image Compression
```javascript
// Compress large images before upload
import ImageResizer from 'react-native-image-resizer';

const compressAndUpload = async (imageUri, projectId) => {
  // Compress image to max 2000px width, 85% quality
  const compressed = await ImageResizer.createResizedImage(
    imageUri,
    2000,  // maxWidth
    2000,  // maxHeight
    'JPEG',
    85,    // quality
  );

  await uploadReceipt(projectId, compressed.uri, category, notes);
};
```

---

## 🔐 Security Notes

1. **API Key Storage**: Store API key securely using:
   - iOS: Keychain
   - Android: Encrypted SharedPreferences or Keystore

2. **HTTPS Only**: Always use HTTPS in production

3. **Token Refresh**: Monitor API key expiration and prompt user to refresh

4. **Permissions**:
   - Request camera permissions
   - Request storage permissions (for photo library)

5. **Data Privacy**:
   - Receipts may contain sensitive information
   - Warn users about data being sent to OCR service
   - Allow opt-out of OCR if needed

---

## 📊 Analytics & Monitoring

Track these metrics in your mobile app:
- Upload success rate
- Average upload time
- OCR accuracy rate
- File size distribution
- Error types and frequency

---

## ⚠️ Troubleshooting

### Issue: "No API key found"
**Solution**: Ensure `Authorization: Bearer {key}` header is included

### Issue: "File too large"
**Solution**: Compress image before upload (max 10MB)

### Issue: "Invalid project ID"
**Solution**: Verify user has access to the project

### Issue: OCR returns empty data
**Solution**:
- Check image quality
- Ensure receipt is clear and well-lit
- Allow user to manually enter data
- Receipt is still saved even if OCR fails

---

## 🧪 Testing

Use this test script to verify receipt upload works:
```bash
./test-receipt-upload.sh {projectId} {imagePath}
```

Or test manually:
```bash
curl -X POST "https://www.kolmo.design/api/projects/65/receipts" \
  -H "Authorization: Bearer kolmo_3745831a1928c3ed7bc7ffe449592067ade876f86f59ff6a4b12cb0519d95aaa" \
  -F "file=@test-receipt.jpg" \
  -F "category=materials"
```
