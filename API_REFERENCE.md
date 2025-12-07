# AI Progress Reports - API Reference

Quick reference for all AI progress report endpoints.

## Base URL
```
http://localhost:5000
```

## Authentication
All endpoints require admin authentication via session cookie.

## Endpoints

### 1. Generate AI Progress Report

**Creates a draft progress update from project images using AI analysis.**

```http
POST /api/projects/:projectId/updates/generate-ai-report
```

**Headers:**
```
Content-Type: application/json
Cookie: connect.sid=YOUR_SESSION_ID
```

**Body:**
```json
{
  "imageIds": [8, 9, 10, 11, 12],  // Optional: specific images. If omitted, uses unanalyzed images
  "batchByDate": true               // Optional: group images by capture date (default: true)
}
```

**Response:**
```json
{
  "success": true,
  "message": "AI progress report generated successfully",
  "data": {
    "progressUpdateId": 42,
    "status": "draft",
    "visibility": "admin_only",
    "imageCount": 5,
    "estimatedCost": 0.053,
    "analysis": {
      "executiveSummary": "Deck preparation work is underway with surface cleaning completed...",
      "confidence": 0.85
    }
  }
}
```

---

### 2. Get Unanalyzed Image Batches

**Lists groups of images that haven't been analyzed yet, grouped by date.**

```http
GET /api/projects/:projectId/updates/unanalyzed-batches
```

**Headers:**
```
Cookie: connect.sid=YOUR_SESSION_ID
```

**Response:**
```json
{
  "success": true,
  "batches": [
    {
      "date": "2025-12-06",
      "imageCount": 5,
      "imageIds": [8, 9, 10, 11, 12],
      "thumbnails": [
        "/api/storage/proxy/drive-ingestion%2FIMG20251206142909.jpg",
        "/api/storage/proxy/drive-ingestion%2FIMG20251206142208.jpg",
        "/api/storage/proxy/drive-ingestion%2FIMG20251206141321.jpg"
      ]
    },
    {
      "date": "2025-12-05",
      "imageCount": 3,
      "imageIds": [5, 6, 7],
      "thumbnails": ["..."]
    }
  ]
}
```

---

### 3. Approve Progress Report

**Approves an AI-generated report and optionally publishes to client portal.**

```http
PUT /api/projects/:projectId/updates/:updateId/approve
```

**Headers:**
```
Content-Type: application/json
Cookie: connect.sid=YOUR_SESSION_ID
```

**Body:**
```json
{
  "publish": true,                    // Optional: immediately publish to clients (default: false)
  "editedDescription": "Modified..."  // Optional: edited description to save
}
```

**Response:**
```json
{
  "success": true,
  "message": "Report approved and published to client portal",
  "data": {
    "id": 42,
    "status": "approved",
    "visibility": "published",
    "reviewedById": 1,
    "reviewedAt": "2025-12-06T14:30:00Z",
    ...
  }
}
```

---

### 4. Reject Progress Report

**Rejects an AI-generated report with optional reason.**

```http
PUT /api/projects/:projectId/updates/:updateId/reject
```

**Headers:**
```
Content-Type: application/json
Cookie: connect.sid=YOUR_SESSION_ID
```

**Body:**
```json
{
  "reason": "Analysis is too generic, needs more specific observations"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Report rejected",
  "data": {
    "id": 42,
    "status": "rejected",
    "visibility": "admin_only",
    "reviewedById": 1,
    "reviewedAt": "2025-12-06T14:30:00Z",
    ...
  }
}
```

---

### 5. Publish Approved Report

**Makes an approved report visible in the client portal.**

```http
PUT /api/projects/:projectId/updates/:updateId/publish
```

**Headers:**
```
Cookie: connect.sid=YOUR_SESSION_ID
```

**Response:**
```json
{
  "success": true,
  "message": "Report published to client portal",
  "data": {
    "id": 42,
    "visibility": "published",
    "updatedAt": "2025-12-06T14:35:00Z",
    ...
  }
}
```

**Requirements:**
- Report status must be `approved`
- Only approved reports can be published

---

### 6. Unpublish Report

**Removes a report from client portal visibility.**

```http
PUT /api/projects/:projectId/updates/:updateId/unpublish
```

**Headers:**
```
Cookie: connect.sid=YOUR_SESSION_ID
```

**Response:**
```json
{
  "success": true,
  "message": "Report removed from client portal",
  "data": {
    "id": 42,
    "visibility": "admin_only",
    "updatedAt": "2025-12-06T14:40:00Z",
    ...
  }
}
```

---

### 7. Get Progress Updates (Client-Filtered)

**Gets all progress updates for a project with client visibility filtering.**

```http
GET /api/projects/:projectId/updates
```

**Headers:**
```
Cookie: connect.sid=YOUR_SESSION_ID
```

**Behavior:**
- **Admin/PM**: Returns all progress updates (draft, approved, rejected)
- **Client**: Returns only updates with `visibility = 'published'`

**Response:**
```json
{
  "updates": [
    {
      "id": 42,
      "projectId": 7,
      "title": "AI Progress Report: 12/6/2025",
      "description": "Deck preparation work is underway...",
      "updateType": "ai_analysis",
      "status": "approved",
      "visibility": "published",
      "generatedByAI": true,
      "createdAt": "2025-12-06T14:00:00Z",
      "aiAnalysisMetadata": {
        "confidence": 0.85,
        "tokensUsed": { "input": 8432, "output": 521 },
        "cost": { "total": 0.053 },
        "imageIds": [8, 9, 10, 11, 12]
      }
    }
  ]
}
```

---

## Status Workflow

```
draft → (approve) → approved → (publish) → published
  ↓                              ↓
(reject)                   (unpublish)
  ↓                              ↓
rejected                    admin_only
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (not logged in)
- `403`: Forbidden (not admin)
- `404`: Not Found (update doesn't exist)
- `500`: Internal Server Error

## Example: Complete Workflow

```bash
# Set your session ID
SESSION="connect.sid=YOUR_SESSION_ID_HERE"

# 1. Generate AI report for project 7
RESULT=$(curl -s -X POST http://localhost:5000/api/projects/7/updates/generate-ai-report \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION" \
  -d '{"imageIds": [8,9,10,11,12]}')

# Extract update ID
UPDATE_ID=$(echo $RESULT | jq -r '.data.progressUpdateId')
echo "Generated report ID: $UPDATE_ID"

# 2. Review the report (manually via dashboard at /admin/ai-report-review)

# 3. Approve and publish it
curl -X PUT "http://localhost:5000/api/projects/7/updates/$UPDATE_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION" \
  -d '{"publish": true}'

echo "Report approved and published!"

# 4. Verify it's visible (as client)
curl -s "http://localhost:5000/api/projects/7/updates" \
  -H "Cookie: $CLIENT_SESSION" | jq ".updates[] | select(.id == $UPDATE_ID)"
```

## POC Endpoint (Testing Only)

**For testing the AI analysis without creating database records:**

```http
POST /api/projects/:projectId/updates/analyze-images-poc
```

**Body:**
```json
{
  "imageIds": [8, 9, 10, 11, 12],
  "previousReportSummary": "Optional previous report text for comparison"
}
```

**Returns:** Raw analysis results without saving to database.

---

## Web Dashboard Routes

- **POC Testing**: `/admin/image-analysis-poc`
- **Report Review**: `/admin/ai-report-review`
- **Client Portal**: `/project-details/:projectId` (progress updates tab)

## Database Queries

### Find all AI-generated reports for a project
```sql
SELECT * FROM progress_updates
WHERE project_id = 7 AND generated_by_ai = TRUE
ORDER BY created_at DESC;
```

### Check report status breakdown
```sql
SELECT status, visibility, COUNT(*)
FROM progress_updates
WHERE generated_by_ai = TRUE
GROUP BY status, visibility;
```

### Calculate total AI costs
```sql
SELECT
  SUM((ai_analysis_metadata->>'cost')::jsonb->>'total')::numeric as total_cost,
  COUNT(*) as report_count,
  AVG((ai_analysis_metadata->>'confidence')::numeric) as avg_confidence
FROM progress_updates
WHERE generated_by_ai = TRUE;
```

### Get latest summary for a project
```sql
SELECT * FROM progress_report_summaries
WHERE project_id = 7
ORDER BY created_at DESC
LIMIT 1;
```
