# Google Drive Image Ingestion - Setup & Usage

Complete guide for the Google Drive image ingestion service with EXIF parsing and geolocation tracking.

## 🎯 Overview

The Drive Ingestion Service automatically:
- ✅ Fetches images from a specified Google Drive folder
- ✅ Extracts EXIF metadata (GPS coordinates, capture date, device info)
- ✅ Uploads images to R2 storage
- ✅ Stores metadata in PostgreSQL database
- ✅ Provides idempotency (skips already-processed images)

## 📋 Prerequisites

- [x] PostgreSQL database
- [x] R2/S3 storage configured
- [x] Google Cloud project with Drive API enabled
- [x] Service account with Drive access

## 🔧 Setup

### 1. Database Migration

The `drive_images` table has already been created. Verify with:

```bash
psql $DATABASE_URL -c "\d drive_images"
```

Expected table structure:
```
- id (serial, primary key)
- file_id (text, unique) - Google Drive file ID
- name, mime_type, size
- drive_created_time, drive_modified_time
- latitude, longitude (decimal 10,7) - GPS coordinates
- capture_date - EXIF date or Drive fallback
- device - Camera/phone model
- r2_url, r2_key - R2 storage info
- processed_at (timestamp)
```

### 2. Service Account Credentials

**Already configured!** ✅

- **Location**: `server/config/google-drive-credentials.json`
- **Service Account**: `dirve-poller@kolmo-design-images.iam.gserviceaccount.com`
- **Project**: `kolmo-design-images`
- **Added to .gitignore**: ✅

### 3. Grant Folder Access

**IMPORTANT:** Share your Google Drive folder with the service account:

1. Go to your Google Drive folder
2. Click "Share"
3. Add: `dirve-poller@kolmo-design-images.iam.gserviceaccount.com`
4. Grant "Viewer" permission (read-only)
5. Click "Send"

### 4. Configure Folder ID

Update the folder ID in `DriveIngestionService.ts`:

```typescript
// Line 45
private folderId = 'YOUR_FOLDER_ID_HERE';
```

**To get your folder ID:**
1. Open the folder in Google Drive
2. Copy the ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`

Current default: `1ofiEOheVXs0qOlWcRY6c7T0sdW17xxzw`

## 🧪 Testing

### Test Authentication & Folder Access

```bash
npx tsx server/scripts/test-drive-ingestion.ts
```

This will:
1. ✅ Test Google Drive authentication
2. ✅ Check folder access
3. ✅ List images in the folder
4. ⏭️  Skip ingestion (use `--run` to execute)

### Run Full Ingestion Test

```bash
npx tsx server/scripts/test-drive-ingestion.ts --run
```

This will:
1. Download new images from Drive
2. Parse EXIF metadata
3. Upload to R2
4. Save to database

### Verbose Output

```bash
npx tsx server/scripts/test-drive-ingestion.ts --run --verbose
```

## 🚀 Usage

### Option 1: API Endpoints (Recommended)

#### Trigger Ingestion
```http
POST /api/drive-ingestion/trigger
Authorization: Bearer {admin_token}
```

Response:
```json
{
  "success": true,
  "message": "Successfully ingested 5 new image(s)",
  "data": {
    "count": 5,
    "duration": 12450,
    "images": [
      {
        "fileId": "1abc...",
        "name": "IMG_1234.jpg",
        "size": 2457600,
        "hasGPS": true,
        "latitude": 37.7749,
        "longitude": -122.4194,
        "captureDate": "2024-03-15T10:30:00Z",
        "device": "Apple iPhone 14 Pro",
        "r2Url": "/api/storage/proxy/drive-ingestion%2F..."
      }
    ]
  }
}
```

#### Get Status
```http
GET /api/drive-ingestion/status
Authorization: Bearer {admin_token}
```

Response:
```json
{
  "success": true,
  "data": {
    "totalImages": 42,
    "imagesWithGPS": 38,
    "imagesWithDevice": 40,
    "lastProcessedAt": "2024-03-20T14:30:00Z",
    "serviceAccount": "dirve-poller@kolmo-design-images.iam.gserviceaccount.com"
  }
}
```

#### List Ingested Images
```http
GET /api/drive-ingestion/images?limit=20&offset=0
Authorization: Bearer {admin_token}
```

### Option 2: Programmatic Usage

```typescript
import { createDriveService } from './server/services/drive-service-factory';

async function ingestImages() {
  // Create service with default config
  const service = await createDriveService();

  // Run ingestion
  const results = await service.ingestNewImages();

  console.log(`Ingested ${results.length} images`);

  // Process results
  results.forEach(img => {
    console.log(`${img.name}:`);
    console.log(`  GPS: ${img.lat}, ${img.lon}`);
    console.log(`  Date: ${img.date}`);
    console.log(`  Device: ${img.device}`);
  });
}
```

### Option 3: Scheduled Ingestion

Using node-cron (example):

```typescript
import cron from 'node-cron';
import { createDriveService } from './server/services/drive-service-factory';

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('[Scheduler] Starting daily Drive ingestion...');

  try {
    const service = await createDriveService();
    const results = await service.ingestNewImages();
    console.log(`[Scheduler] Ingested ${results.length} images`);
  } catch (error) {
    console.error('[Scheduler] Ingestion failed:', error);
  }
});
```

## 📊 Data Flow

```
Google Drive Folder
        ↓
  [Query images]
        ↓
[Filter new files] ← Check DB for existing fileIds
        ↓
[Download image]
        ↓
[Parse EXIF] ← Extract GPS, date, device
        ↓
[Upload to R2]
        ↓
[Save to database]
        ↓
    Complete!
```

## 🗂️ File Structure

```
server/
├── services/
│   ├── DriveIngestionService.ts          # Main service
│   ├── drive-service-factory.ts          # Factory & auth helper
│   └── DriveIngestionService.example.ts  # Usage examples
├── routes/
│   └── drive-ingestion.routes.ts         # API endpoints
├── scripts/
│   └── test-drive-ingestion.ts          # Test & CLI script
└── config/
    └── google-drive-credentials.json     # Service account (gitignored)

shared/
└── schema.ts                             # Database schema (driveImages table)

migrations/
└── 0002_rare_red_wolf.sql               # DB migration
```

## 🔐 Security

- ✅ Service account credentials stored in gitignored file
- ✅ All API endpoints require admin authentication
- ✅ Read-only Drive access (Viewer permission)
- ✅ Credentials never exposed in logs or API responses

## 🐛 Troubleshooting

### Authentication Failed

**Error**: "credentials not found" or "permission denied"

**Solution**:
1. Verify `server/config/google-drive-credentials.json` exists
2. Check JSON is valid and complete
3. Ensure Drive API is enabled in Google Cloud Console

### Folder Access Denied

**Error**: "Access denied to folder" or "404 Not Found"

**Solution**:
1. Verify folder ID is correct
2. Share folder with: `dirve-poller@kolmo-design-images.iam.gserviceaccount.com`
3. Grant "Viewer" permission
4. Wait 1-2 minutes for permissions to propagate

### No GPS Coordinates

**Issue**: Images ingested but `latitude` and `longitude` are null

**Explanation**: Not all images contain GPS EXIF data. This is normal for:
- Screenshots
- Images from cameras without GPS
- Images with EXIF data stripped

**Solution**: This is expected behavior. The service stores `null` for missing GPS data.

### R2 Upload Failed

**Error**: "Failed to upload file to R2 storage"

**Solution**:
1. Verify R2 environment variables in `.env.local`:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=...
   ```
2. Restart dev server after changing env vars
3. Check R2 bucket permissions

## 📚 API Reference

### POST /api/drive-ingestion/trigger

Trigger a new ingestion run.

**Auth**: Admin required

**Response**: `{ success, message, data: { count, duration, images[] } }`

### GET /api/drive-ingestion/status

Get ingestion service statistics.

**Auth**: Admin required

**Response**: `{ success, data: { totalImages, imagesWithGPS, ... } }`

### GET /api/drive-ingestion/images

List ingested images with pagination.

**Auth**: Admin required

**Query Params**:
- `limit` (number, max 100, default 50)
- `offset` (number, default 0)

**Response**: `{ success, data: { images[], pagination } }`

## 🎯 Next Steps

1. **Test the setup**:
   ```bash
   npx tsx server/scripts/test-drive-ingestion.ts --run
   ```

2. **Verify in database**:
   ```sql
   SELECT name, latitude, longitude, device, capture_date
   FROM drive_images
   ORDER BY processed_at DESC
   LIMIT 10;
   ```

3. **Use the API**:
   - Trigger ingestion via POST `/api/drive-ingestion/trigger`
   - View results in admin dashboard

4. **Schedule regular ingestion** (optional):
   - Set up cron job
   - Or trigger manually when needed

## ✅ Checklist

- [x] Database migration applied
- [x] Service account credentials configured
- [ ] Google Drive folder shared with service account
- [ ] Folder ID updated in `DriveIngestionService.ts`
- [ ] Test authentication successful
- [ ] Test ingestion successful
- [ ] API endpoints working
- [ ] R2 storage configured

---

**Service Account**: `dirve-poller@kolmo-design-images.iam.gserviceaccount.com`

**Support**: Check logs in console or contact your admin.
