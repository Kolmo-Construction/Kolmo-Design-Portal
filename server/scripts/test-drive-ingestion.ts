#!/usr/bin/env tsx
/**
 * Test script for Google Drive Ingestion Service
 *
 * Usage:
 *   npx tsx server/scripts/test-drive-ingestion.ts
 *
 * Or add to package.json:
 *   "scripts": {
 *     "test:drive": "tsx server/scripts/test-drive-ingestion.ts",
 *     "ingest:drive": "tsx server/scripts/test-drive-ingestion.ts --run"
 *   }
 */

import { createDriveService, testDriveAuth } from '../services/drive-service-factory';

async function main() {
  const args = process.argv.slice(2);
  const shouldRun = args.includes('--run') || args.includes('-r');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('═══════════════════════════════════════════════');
  console.log('  Google Drive Ingestion Service Test');
  console.log('═══════════════════════════════════════════════\n');

  // Step 1: Test authentication
  console.log('Step 1: Testing authentication...\n');
  const authSuccess = await testDriveAuth();

  if (!authSuccess) {
    console.error('\n❌ Authentication test failed. Please fix the issues above and try again.');
    process.exit(1);
  }

  console.log('\n' + '─'.repeat(47) + '\n');

  // Step 2: Check folder access
  console.log('Step 2: Checking folder access...\n');

  try {
    const service = await createDriveService();
    const drive = (service as any).drive;
    const folderId = (service as any).folderId;

    // Try to get folder metadata
    try {
      const folder = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType',
      });

      console.log('✅ Folder access confirmed!');
      console.log(`   Folder: ${folder.data.name}`);
      console.log(`   ID: ${folder.data.id}`);
    } catch (error: any) {
      if (error.code === 404) {
        console.error('❌ Folder not found!');
        console.error(`   Folder ID: ${folderId}`);
        console.error('\n💡 Make sure:');
        console.error('   1. The folder ID is correct');
        console.error('   2. The folder has been shared with the service account');
        console.error('   3. Service account email: dirve-poller@kolmo-design-images.iam.gserviceaccount.com');
      } else if (error.code === 403) {
        console.error('❌ Access denied to folder!');
        console.error(`   Folder ID: ${folderId}`);
        console.error('\n💡 The folder needs to be shared with:');
        console.error('   dirve-poller@kolmo-design-images.iam.gserviceaccount.com');
      } else {
        throw error;
      }
      process.exit(1);
    }

    // List images in folder
    console.log('\n📂 Listing images in folder...\n');

    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id, name, mimeType, size, createdTime)',
      pageSize: 10,
      orderBy: 'createdTime desc',
    });

    const files = response.data.files || [];
    console.log(`Found ${files.length} image(s) in folder`);

    if (files.length > 0 && verbose) {
      console.log('\nImages:');
      files.forEach((file, idx) => {
        const sizeMB = (parseInt(file.size || '0') / (1024 * 1024)).toFixed(2);
        console.log(`  ${idx + 1}. ${file.name}`);
        console.log(`     Size: ${sizeMB} MB`);
        console.log(`     ID: ${file.id}`);
      });
    }

    console.log('\n' + '─'.repeat(47) + '\n');

    // Step 3: Run ingestion if requested
    if (shouldRun) {
      console.log('Step 3: Running ingestion...\n');

      try {
        const results = await service.ingestNewImages();

        console.log(`\n✅ Ingestion complete! Processed ${results.length} new image(s)\n`);

        if (results.length > 0) {
          console.log('Results:');
          results.forEach((img, idx) => {
            console.log(`\n${idx + 1}. ${img.name}`);
            console.log(`   File ID: ${img.fileId}`);
            console.log(`   GPS: ${img.lat ? `${img.lat}, ${img.lon}` : 'No GPS data'}`);
            console.log(`   Date: ${img.date ? img.date.toISOString() : 'Unknown'}`);
            console.log(`   Device: ${img.device || 'Unknown'}`);
            console.log(`   R2 URL: ${img.r2Url}`);
          });
        } else {
          console.log('No new images to process (all images already ingested)');
        }
      } catch (error) {
        console.error('\n❌ Ingestion failed:', error);
        throw error;
      }
    } else {
      console.log('Step 3: Skipped (use --run to execute ingestion)\n');
      console.log('💡 To run ingestion: npx tsx server/scripts/test-drive-ingestion.ts --run');
    }

    console.log('\n' + '═'.repeat(47));
    console.log('✅ All tests passed!');
    console.log('═'.repeat(47) + '\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as testDriveIngestion };
