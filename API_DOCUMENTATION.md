# Kolmo Design Portal - Mobile API Documentation

**Version:** 1.0
**Base URL:** `http://localhost:3000/api` (Development)
**Production URL:** `https://your-domain.com/api`

---

## Table of Contents

1. [Authentication](#authentication)
2. [API Key Management](#api-key-management)
3. [Time Tracking](#time-tracking)
4. [Receipt Scanning](#receipt-scanning)
5. [Projects](#projects)
6. [Error Handling](#error-handling)
7. [Rate Limits](#rate-limits)

---

## Authentication

All mobile API endpoints require authentication via API keys using Bearer token authentication.

### Header Format

```http
Authorization: Bearer kolmo_your_api_key_here
```

**Alternative header:**
```http
X-API-Key: kolmo_your_api_key_here
```

### Obtaining an API Key

1. Log in to the web portal at `http://localhost:3000`
2. Navigate to **Admin → API Keys** (admin users only)
3. Click **Generate New Key**
4. Copy the key immediately (it will only be shown once)
5. Store the key securely in your mobile app

### Example Authentication

```bash
curl -H "Authorization: Bearer kolmo_c44dd998fb9f394b06d53d1545248666087ef0a9dec08a8ba0dd6ba05f47bb9b" \
     http://localhost:3000/api/projects
```

---

## API Key Management

### Generate API Key

**Endpoint:** `POST /api/api-keys`
**Authentication:** Session-based (Web UI only)
**Role Required:** Admin

Creates a new API key for mobile app authentication.

**Request Body:**
```json
{
  "name": "Mobile App - iPhone",
  "description": "Primary mobile device",
  "expiresInDays": 365
}
```

**Parameters:**
- `name` (string, required): Friendly name for the API key
- `description` (string, optional): Additional description
- `expiresInDays` (number, optional): Number of days until expiration (omit for no expiration)

**Response:** `201 Created`
```json
{
  "id": 1,
  "fullKey": "kolmo_c44dd998fb9f394b06d53d1545248666087ef0a9dec08a8ba0dd6ba05f47bb9b",
  "keyPrefix": "kolmo_c44d",
  "name": "Mobile App - iPhone",
  "expiresAt": "2026-12-08T18:30:00.000Z",
  "createdAt": "2025-12-08T18:30:00.000Z",
  "warning": "Store this key securely. It will not be shown again."
}
```

**⚠️ Important:** The `fullKey` is only returned once. Store it securely.

---

### List API Keys

**Endpoint:** `GET /api/api-keys`
**Authentication:** Session-based (Web UI only)
**Role Required:** Admin

Lists all API keys for the authenticated user (keys are masked).

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "keyPrefix": "kolmo_c44d",
    "name": "Mobile App - iPhone",
    "description": "Primary mobile device",
    "isActive": true,
    "expiresAt": "2026-12-08T18:30:00.000Z",
    "lastUsedAt": "2025-12-08T19:45:00.000Z",
    "createdAt": "2025-12-08T18:30:00.000Z"
  }
]
```

---

### Revoke API Key

**Endpoint:** `DELETE /api/api-keys/:id`
**Authentication:** Session-based (Web UI only)
**Role Required:** Admin

Revokes an API key immediately.

**Response:** `200 OK`
```json
{
  "message": "API key revoked successfully"
}
```

---

## Time Tracking

### Clock In

**Endpoint:** `POST /api/time/clock-in`
**Authentication:** API Key (Bearer token)

Start a new time entry for a project with GPS coordinates.

**Request Body:**
```json
{
  "projectId": 10,
  "latitude": 34.052235,
  "longitude": -118.243683,
  "notes": "Starting work on kitchen renovation"
}
```

**Parameters:**
- `projectId` (number, required): Project ID to clock in to
- `latitude` (number, required): GPS latitude coordinate
- `longitude` (number, required): GPS longitude coordinate
- `notes` (string, optional): Additional notes

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Clocked in successfully",
  "timeEntry": {
    "id": 1,
    "projectId": 10,
    "userId": 1,
    "startTime": "2025-12-08T19:45:00.000Z",
    "endTime": null,
    "clockInLatitude": "34.052235",
    "clockInLongitude": "-118.243683",
    "clockInWithinGeofence": true,
    "clockInDistanceMeters": "1.23",
    "notes": "Starting work on kitchen renovation",
    "createdAt": "2025-12-08T19:45:00.000Z"
  },
  "geofenceValidation": {
    "withinGeofence": true,
    "distanceMeters": 1.23
  }
}
```

**Geofencing:**
- System calculates distance from project location using Haversine formula
- Default threshold: 100 meters
- Entries outside geofence are flagged but not rejected

**Error Responses:**

`400 Bad Request` - Invalid coordinates or missing fields:
```json
{
  "success": false,
  "error": "Missing required fields"
}
```

`409 Conflict` - Already clocked in:
```json
{
  "success": false,
  "error": "Already clocked in. Please clock out first."
}
```

---

### Clock Out

**Endpoint:** `POST /api/time/clock-out`
**Authentication:** API Key (Bearer token)

End the active time entry with GPS coordinates.

**Request Body:**
```json
{
  "latitude": 34.052240,
  "longitude": -118.243680,
  "notes": "Completed kitchen cabinet installation"
}
```

**Parameters:**
- `latitude` (number, required): GPS latitude coordinate
- `longitude` (number, required): GPS longitude coordinate
- `notes` (string, optional): Additional notes

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Clocked out successfully",
  "timeEntry": {
    "id": 1,
    "projectId": 10,
    "userId": 1,
    "startTime": "2025-12-08T19:45:00.000Z",
    "endTime": "2025-12-08T20:46:00.000Z",
    "durationMinutes": 61,
    "clockInLatitude": "34.052235",
    "clockInLongitude": "-118.243683",
    "clockOutLatitude": "34.052240",
    "clockOutLongitude": "-118.243680",
    "clockInWithinGeofence": true,
    "clockInDistanceMeters": "1.23",
    "clockOutWithinGeofence": true,
    "clockOutDistanceMeters": "2.45",
    "notes": "Completed kitchen cabinet installation",
    "createdAt": "2025-12-08T19:45:00.000Z",
    "updatedAt": "2025-12-08T20:46:00.000Z"
  },
  "geofenceValidation": {
    "withinGeofence": true,
    "distanceMeters": 2.45
  }
}
```

**Error Responses:**

`404 Not Found` - No active time entry:
```json
{
  "success": false,
  "error": "No active time entry found"
}
```

---

### Get Time Entries

**Endpoint:** `GET /api/time/entries`
**Authentication:** API Key (Bearer token)

Retrieve time entries with optional filters.

**Query Parameters:**
- `projectId` (number, optional): Filter by project
- `startDate` (ISO date, optional): Filter entries after this date
- `endDate` (ISO date, optional): Filter entries before this date
- `userId` (number, optional): Filter by user (admin/PM only)

**Example Request:**
```bash
curl "http://localhost:3000/api/time/entries?projectId=10&startDate=2025-12-01" \
  -H "Authorization: Bearer kolmo_your_api_key"
```

**Response:** `200 OK`
```json
{
  "success": true,
  "entries": [
    {
      "id": 1,
      "projectId": 10,
      "userId": 1,
      "startTime": "2025-12-08T19:45:00.000Z",
      "endTime": "2025-12-08T20:46:00.000Z",
      "durationMinutes": 61,
      "clockInWithinGeofence": true,
      "clockOutWithinGeofence": true,
      "notes": "Completed kitchen cabinet installation",
      "project": {
        "id": 10,
        "name": "Kitchen Renovation",
        "address": "123 Main St"
      },
      "user": {
        "id": 1,
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ]
}
```

---

### Get Active Time Entry

**Endpoint:** `GET /api/time/active`
**Authentication:** API Key (Bearer token)

Get the current user's active time entry (if any).

**Response:** `200 OK`

**If active entry exists:**
```json
{
  "success": true,
  "active": true,
  "timeEntry": {
    "id": 1,
    "projectId": 10,
    "userId": 1,
    "startTime": "2025-12-08T19:45:00.000Z",
    "endTime": null,
    "clockInLatitude": "34.052235",
    "clockInLongitude": "-118.243683",
    "clockInWithinGeofence": true,
    "project": {
      "id": 10,
      "name": "Kitchen Renovation"
    }
  }
}
```

**If no active entry:**
```json
{
  "success": true,
  "active": false,
  "timeEntry": null
}
```

---

## Receipt Scanning

### Upload Receipt

**Endpoint:** `POST /api/projects/:projectId/receipts`
**Authentication:** API Key (Bearer token)
**Content-Type:** `multipart/form-data`

Upload and scan a receipt with Taggun OCR.

**URL Parameters:**
- `projectId` (number): Project ID to associate receipt with

**Form Data:**
- `file` (file, required): Image file (JPEG, PNG, PDF)
- `category` (string, optional): Expense category (`materials`, `labor`, `equipment`, `other`)
- `notes` (string, optional): Additional notes

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/projects/10/receipts" \
  -H "Authorization: Bearer kolmo_your_api_key" \
  -F "file=@receipt.jpg" \
  -F "category=materials" \
  -F "notes=Home Depot hardware purchase"
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Receipt uploaded successfully",
  "receipt": {
    "id": 1,
    "projectId": 10,
    "uploadedBy": 1,
    "vendorName": "HOME DEPOT",
    "totalAmount": "49.48",
    "currency": "USD",
    "receiptDate": "2025-12-08T00:00:00.000Z",
    "category": "materials",
    "notes": "Home Depot hardware purchase",
    "imageUrl": "/api/storage/proxy/receipts%2Fproject-10%2Freceipt-abc123.jpg",
    "imageKey": "receipts/project-10/receipt-abc123.jpg",
    "ocrConfidence": "0.92",
    "isVerified": false,
    "createdAt": "2025-12-08T19:45:00.000Z",
    "uploader": {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe"
    }
  },
  "ocr": {
    "success": true,
    "confidence": 0.92,
    "error": null
  }
}
```

**File Limits:**
- Maximum file size: 10MB
- Supported formats: JPEG, PNG, PDF
- Image resolution: Recommended 300 DPI or higher for best OCR results

**OCR Data:**
The Taggun service automatically extracts:
- Vendor/merchant name
- Total amount
- Receipt date
- Individual line items
- Tax amounts
- Confidence scores

**Error Responses:**

`400 Bad Request` - Invalid file:
```json
{
  "success": false,
  "message": "Only image files and PDFs are allowed"
}
```

`413 Payload Too Large` - File too large:
```json
{
  "success": false,
  "message": "File size exceeds 10MB limit"
}
```

---

### Get Receipts

**Endpoint:** `GET /api/projects/:projectId/receipts`
**Authentication:** API Key (Bearer token)

Retrieve all receipts for a project.

**Query Parameters:**
- `startDate` (ISO date, optional): Filter receipts after this date
- `endDate` (ISO date, optional): Filter receipts before this date
- `category` (string, optional): Filter by category
- `isVerified` (boolean, optional): Filter by verification status

**Example Request:**
```bash
curl "http://localhost:3000/api/projects/10/receipts?category=materials" \
  -H "Authorization: Bearer kolmo_your_api_key"
```

**Response:** `200 OK`
```json
{
  "success": true,
  "receipts": [
    {
      "id": 1,
      "projectId": 10,
      "vendorName": "HOME DEPOT",
      "totalAmount": "49.48",
      "receiptDate": "2025-12-08T00:00:00.000Z",
      "category": "materials",
      "imageUrl": "/api/storage/proxy/receipts%2Fproject-10%2Freceipt-abc123.jpg",
      "isVerified": false,
      "createdAt": "2025-12-08T19:45:00.000Z"
    }
  ]
}
```

---

### Get Single Receipt

**Endpoint:** `GET /api/receipts/:id`
**Authentication:** API Key (Bearer token)

Get detailed information about a specific receipt.

**Response:** `200 OK`
```json
{
  "success": true,
  "receipt": {
    "id": 1,
    "projectId": 10,
    "uploadedBy": 1,
    "vendorName": "HOME DEPOT",
    "totalAmount": "49.48",
    "currency": "USD",
    "receiptDate": "2025-12-08T00:00:00.000Z",
    "category": "materials",
    "notes": "Home Depot hardware purchase",
    "imageUrl": "/api/storage/proxy/receipts%2Fproject-10%2Freceipt-abc123.jpg",
    "ocrData": {
      "merchantName": { "data": "HOME DEPOT", "confidence": 0.95 },
      "totalAmount": { "data": 49.48, "confidence": 0.92 },
      "date": { "data": "2025-12-08", "confidence": 0.89 },
      "lineItems": [
        { "description": "2x4 Lumber", "amount": 25.99 },
        { "description": "Screws Box", "amount": 15.49 },
        { "description": "Tax", "amount": 8.00 }
      ]
    },
    "ocrConfidence": "0.92",
    "isVerified": false,
    "createdAt": "2025-12-08T19:45:00.000Z",
    "project": {
      "id": 10,
      "name": "Kitchen Renovation"
    },
    "uploader": {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

---

### Update Receipt

**Endpoint:** `PATCH /api/receipts/:id`
**Authentication:** API Key (Bearer token)

Update receipt metadata (manual corrections to OCR data).

**Request Body:**
```json
{
  "vendorName": "The Home Depot",
  "totalAmount": 49.48,
  "receiptDate": "2025-12-08",
  "category": "materials",
  "notes": "Updated vendor name"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Receipt updated successfully",
  "receipt": { /* updated receipt object */ }
}
```

---

### Delete Receipt

**Endpoint:** `DELETE /api/receipts/:id`
**Authentication:** API Key (Bearer token)

Delete a receipt (uploader or admin only).

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Receipt deleted successfully"
}
```

---

### Get Expense Summary

**Endpoint:** `GET /api/projects/:projectId/expenses`
**Authentication:** API Key (Bearer token)

Get aggregated expense summary for a project.

**Response:** `200 OK`
```json
{
  "success": true,
  "summary": {
    "totalAmount": 1234.56,
    "totalReceipts": 15,
    "byCategory": [
      {
        "category": "materials",
        "amount": 850.00,
        "count": 10
      },
      {
        "category": "equipment",
        "amount": 384.56,
        "count": 5
      }
    ],
    "byVendor": [
      {
        "vendor": "HOME DEPOT",
        "amount": 650.00,
        "count": 8
      },
      {
        "vendor": "LOWES",
        "amount": 200.00,
        "count": 2
      }
    ],
    "verified": 10,
    "unverified": 5
  }
}
```

---

## Projects

### Get All Projects

**Endpoint:** `GET /api/projects`
**Authentication:** API Key (Bearer token)

Get list of all projects accessible to the authenticated user.

**Response:** `200 OK`
```json
[
  {
    "id": 10,
    "name": "Kitchen Renovation",
    "address": "123 Main St, Los Angeles, CA",
    "latitude": "34.052235",
    "longitude": "-118.243683",
    "status": "active",
    "startDate": "2025-12-01T00:00:00.000Z",
    "client": {
      "id": 5,
      "firstName": "Jane",
      "lastName": "Smith"
    }
  }
]
```

---

### Get Project Details

**Endpoint:** `GET /api/projects/:id`
**Authentication:** API Key (Bearer token)

Get detailed information about a specific project.

**Response:** `200 OK`
```json
{
  "id": 10,
  "name": "Kitchen Renovation",
  "description": "Complete kitchen remodel with new cabinets",
  "address": "123 Main St, Los Angeles, CA",
  "latitude": "34.052235",
  "longitude": "-118.243683",
  "status": "active",
  "startDate": "2025-12-01T00:00:00.000Z",
  "estimatedCompletionDate": "2026-02-01T00:00:00.000Z",
  "client": {
    "id": 5,
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com"
  },
  "projectManager": {
    "id": 2,
    "firstName": "Bob",
    "lastName": "Johnson"
  }
}
```

---

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "details": { /* optional additional details */ }
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created successfully |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Invalid or missing API key |
| `403` | Forbidden - Valid API key but insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Request conflicts with current state (e.g., already clocked in) |
| `413` | Payload Too Large - File size exceeds limit |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error |

### Authentication Errors

**Missing API Key:**
```json
{
  "error": "Unauthorized"
}
```

**Invalid API Key:**
```json
{
  "error": "Unauthorized"
}
```

**Expired API Key:**
```json
{
  "error": "API key has expired"
}
```

---

## Rate Limits

Currently, there are no enforced rate limits for API keys. However, recommended best practices:

- **Clock In/Out:** Max 2 requests per minute
- **Receipt Upload:** Max 10 files per minute
- **List Endpoints:** Max 60 requests per minute

Future implementations may enforce these limits to prevent abuse.

---

## Mobile App Integration Examples

### Swift (iOS)

```swift
import Foundation

class KolmoAPI {
    let baseURL = "http://localhost:3000/api"
    let apiKey = "kolmo_your_api_key"

    func clockIn(projectId: Int, latitude: Double, longitude: Double) async throws {
        let url = URL(string: "\(baseURL)/time/clock-in")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = [
            "projectId": projectId,
            "latitude": latitude,
            "longitude": longitude
        ] as [String : Any]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 201 else {
            throw APIError.invalidResponse
        }

        let result = try JSONDecoder().decode(ClockInResponse.self, from: data)
        print("Clocked in: \(result)")
    }

    func uploadReceipt(projectId: Int, imageData: Data, category: String) async throws {
        let url = URL(string: "\(baseURL)/projects/\(projectId)/receipts")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)",
                        forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"receipt.jpg\"\r\n")
        body.append("Content-Type: image/jpeg\r\n\r\n")
        body.append(imageData)
        body.append("\r\n")
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"category\"\r\n\r\n")
        body.append(category)
        body.append("\r\n--\(boundary)--\r\n")

        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 201 else {
            throw APIError.invalidResponse
        }

        let result = try JSONDecoder().decode(ReceiptResponse.self, from: data)
        print("Receipt uploaded: \(result)")
    }
}

extension Data {
    mutating func append(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}
```

### React Native

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';
const API_KEY = 'kolmo_your_api_key';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Clock In
export const clockIn = async (projectId, latitude, longitude, notes = '') => {
  try {
    const response = await apiClient.post('/time/clock-in', {
      projectId,
      latitude,
      longitude,
      notes,
    });
    return response.data;
  } catch (error) {
    console.error('Clock in failed:', error.response?.data);
    throw error;
  }
};

// Clock Out
export const clockOut = async (latitude, longitude, notes = '') => {
  try {
    const response = await apiClient.post('/time/clock-out', {
      latitude,
      longitude,
      notes,
    });
    return response.data;
  } catch (error) {
    console.error('Clock out failed:', error.response?.data);
    throw error;
  }
};

// Upload Receipt
export const uploadReceipt = async (projectId, imageUri, category, notes = '') => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'receipt.jpg',
    });
    formData.append('category', category);
    if (notes) formData.append('notes', notes);

    const response = await apiClient.post(
      `/projects/${projectId}/receipts`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Receipt upload failed:', error.response?.data);
    throw error;
  }
};

// Get Projects
export const getProjects = async () => {
  try {
    const response = await apiClient.get('/projects');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch projects:', error.response?.data);
    throw error;
  }
};

// Get Expense Summary
export const getExpenseSummary = async (projectId) => {
  try {
    const response = await apiClient.get(`/projects/${projectId}/expenses`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch expenses:', error.response?.data);
    throw error;
  }
};
```

---

## Testing with curl

### Complete Workflow Example

```bash
# 1. Get all projects
curl -H "Authorization: Bearer kolmo_your_api_key" \
     http://localhost:3000/api/projects

# 2. Clock in to a project
curl -X POST http://localhost:3000/api/time/clock-in \
  -H "Authorization: Bearer kolmo_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 10,
    "latitude": 34.052235,
    "longitude": -118.243683,
    "notes": "Starting work"
  }'

# 3. Upload a receipt
curl -X POST http://localhost:3000/api/projects/10/receipts \
  -H "Authorization: Bearer kolmo_your_api_key" \
  -F "file=@receipt.jpg" \
  -F "category=materials" \
  -F "notes=Hardware purchase"

# 4. Get expense summary
curl -H "Authorization: Bearer kolmo_your_api_key" \
     http://localhost:3000/api/projects/10/expenses

# 5. Clock out
curl -X POST http://localhost:3000/api/time/clock-out \
  -H "Authorization: Bearer kolmo_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 34.052240,
    "longitude": -118.243680,
    "notes": "Work completed"
  }'

# 6. Get time entries
curl -H "Authorization: Bearer kolmo_your_api_key" \
     "http://localhost:3000/api/time/entries?projectId=10"
```

---

## Security Best Practices

1. **Store API Keys Securely**
   - Use iOS Keychain or Android Keystore
   - Never hardcode keys in source code
   - Never commit keys to version control

2. **Use HTTPS in Production**
   - All API calls must use HTTPS in production
   - Certificate pinning recommended for mobile apps

3. **Handle Key Expiration**
   - Check for 401 errors indicating expired keys
   - Prompt user to generate new key via web portal

4. **Validate Input**
   - Validate coordinates before sending
   - Check file sizes before upload
   - Sanitize user input

5. **Error Handling**
   - Implement retry logic with exponential backoff
   - Handle network failures gracefully
   - Store failed requests for retry when online

---

## Support

For API support or issues:
- **Email:** support@kolmo.com
- **Documentation:** Check this file for updates
- **Status Page:** Check server logs at `/tmp/server_startup.log`

---

**Last Updated:** December 8, 2025
**API Version:** 1.0
