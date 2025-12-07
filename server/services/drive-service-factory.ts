/**
 * Factory for creating DriveIngestionService with proper authentication
 */

import { google } from 'googleapis';
import { DriveIngestionService } from './DriveIngestionService';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration options for Drive service
 */
export interface DriveServiceConfig {
  // Path to service account credentials JSON file
  credentialsPath?: string;
  // Or provide credentials directly
  credentials?: any;
  // Google Drive folder ID to monitor
  folderId?: string;
}

/**
 * Create and configure DriveIngestionService
 */
export async function createDriveService(config?: DriveServiceConfig): Promise<DriveIngestionService> {
  // Default credentials path
  const defaultCredentialsPath = path.join(__dirname, '../config/google-drive-credentials.json');

  let credentials;

  // Load credentials
  if (config?.credentials) {
    credentials = config.credentials;
  } else {
    const credPath = config?.credentialsPath || defaultCredentialsPath;

    if (!fs.existsSync(credPath)) {
      throw new Error(
        `Google Drive credentials not found at: ${credPath}\n` +
        'Please ensure the service account credentials file exists.'
      );
    }

    credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  }

  // Create Google Auth client
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
  });

  // Get authenticated client
  const authClient = await auth.getClient();

  // Create and return service
  const service = new DriveIngestionService(authClient);

  // Override folder ID if provided
  if (config?.folderId) {
    (service as any).folderId = config.folderId;
  }

  console.log('✅ DriveIngestionService initialized');
  console.log('   Service Account:', credentials.client_email);
  console.log('   Project:', credentials.project_id);
  console.log('   Folder ID:', (service as any).folderId);

  return service;
}

/**
 * Test Drive service authentication
 */
export async function testDriveAuth(config?: DriveServiceConfig): Promise<boolean> {
  try {
    console.log('🔍 Testing Google Drive authentication...');

    const service = await createDriveService(config);

    // Try to list files (even if folder is empty)
    const drive = (service as any).drive;
    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)',
    });

    console.log('✅ Authentication successful!');
    console.log(`   Can access Drive API`);

    return true;
  } catch (error) {
    console.error('❌ Authentication failed:');

    if (error instanceof Error) {
      console.error('   Error:', error.message);

      // Provide helpful error messages
      if (error.message.includes('credentials')) {
        console.error('\n💡 Make sure:');
        console.error('   1. The credentials file exists at the specified path');
        console.error('   2. The JSON is valid and complete');
      } else if (error.message.includes('permission') || error.message.includes('403')) {
        console.error('\n💡 Make sure:');
        console.error('   1. The service account has access to Google Drive');
        console.error('   2. The Drive API is enabled in Google Cloud Console');
        console.error('   3. The folder has been shared with:', '(check credentials)');
      }
    }

    return false;
  }
}

/**
 * Get service account email from credentials
 */
export function getServiceAccountEmail(credentialsPath?: string): string | null {
  try {
    const defaultPath = path.join(__dirname, '../config/google-drive-credentials.json');
    const credPath = credentialsPath || defaultPath;

    if (!fs.existsSync(credPath)) {
      return null;
    }

    const credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    return credentials.client_email || null;
  } catch (error) {
    console.error('Error reading service account email:', error);
    return null;
  }
}
