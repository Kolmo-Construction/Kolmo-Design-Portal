/**
 * Example usage of DriveIngestionService
 *
 * This service ingests images from Google Drive, extracts EXIF metadata,
 * and stores them in R2 with geolocation data.
 */

import { google } from 'googleapis';
import { DriveIngestionService } from './DriveIngestionService';

// Example 1: Basic usage with service account
async function ingestDriveImages() {
  // Setup Google Drive authentication
  // Option A: Using service account credentials
  const auth = new google.auth.GoogleAuth({
    keyFile: './path/to/service-account-key.json',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  // Create service instance
  const service = new DriveIngestionService(auth);

  try {
    // Run ingestion
    console.log('Starting Drive ingestion...');
    const results = await service.ingestNewImages();

    console.log(`✅ Successfully ingested ${results.length} images`);

    // Display results
    results.forEach((img, index) => {
      console.log(`\n${index + 1}. ${img.name}`);
      console.log(`   File ID: ${img.fileId}`);
      console.log(`   GPS: ${img.lat}, ${img.lon}`);
      console.log(`   Date: ${img.date}`);
      console.log(`   Device: ${img.device || 'Unknown'}`);
      console.log(`   R2 URL: ${img.r2Url}`);
    });
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    throw error;
  }
}

// Example 2: Using OAuth2 credentials
async function ingestWithOAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const service = new DriveIngestionService(oauth2Client);
  const results = await service.ingestNewImages();

  return results;
}

// Example 3: Scheduled ingestion (e.g., using node-cron)
import cron from 'node-cron';

function setupScheduledIngestion() {
  // Run every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Starting daily Drive ingestion...');

    try {
      await ingestDriveImages();
      console.log('[Scheduler] Daily ingestion completed');
    } catch (error) {
      console.error('[Scheduler] Daily ingestion failed:', error);
    }
  });
}

// Example 4: API endpoint
import { Request, Response } from 'express';

async function triggerIngestionEndpoint(req: Request, res: Response) {
  try {
    // Setup auth
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const service = new DriveIngestionService(auth);
    const results = await service.ingestNewImages();

    res.json({
      success: true,
      message: `Ingested ${results.length} images`,
      images: results.map(img => ({
        name: img.name,
        fileId: img.fileId,
        hasGPS: !!(img.lat && img.lon),
        captureDate: img.date,
      })),
    });
  } catch (error) {
    console.error('API ingestion error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Export examples
export {
  ingestDriveImages,
  ingestWithOAuth,
  setupScheduledIngestion,
  triggerIngestionEndpoint,
};
