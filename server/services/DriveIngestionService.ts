import { google } from 'googleapis';
import exifr from 'exifr';
import { db } from '../db';
import { driveImages } from '@shared/schema';
import { uploadToR2 } from '../r2-upload';

// Define the structure for our metadata
interface DriveImageMetadata {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  // EXIF metadata
  lat?: number;
  lon?: number;
  date?: Date;
  device?: string;
  // R2 storage info
  r2Url?: string;
  r2Key?: string;
}

// We'll assume a database table exists. If not, you'll need to create it.
// For now, we'll use a simple interface
interface DriveImageRecord {
  id: number;
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: Date;
  modifiedTime: Date;
  lat?: number;
  lon?: number;
  captureDate?: Date;
  device?: string;
  r2Url?: string;
  r2Key?: string;
  processedAt: Date;
}

export class DriveIngestionService {
  private drive;
  private folderId = '1ofiEOheVXs0qOlWcRY6c7T0sdW17xxzw';

  constructor(auth: any) {
    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Main ingestion process
   */
  async ingestNewImages(): Promise<DriveImageMetadata[]> {
    try {
      // 1. List image files from Google Drive folder
      const imageFiles = await this.listDriveImages();
      
      // 2. Filter to only new files (not in database)
      const newFiles = await this.filterNewFiles(imageFiles);
      
      // 3. Process each new file
      const results: DriveImageMetadata[] = [];
      for (const file of newFiles) {
        try {
          const result = await this.processImageFile(file);
          results.push(result);
        } catch (error) {
          console.error(`Failed to process file ${file.id}:`, error);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Ingestion failed:', error);
      throw error;
    }
  }

  /**
   * List all image files in the configured Drive folder
   */
  private async listDriveImages(): Promise<any[]> {
    const response = await this.drive.files.list({
      q: `'${this.folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
      orderBy: 'createdTime desc',
    });

    return response.data.files || [];
  }

  /**
   * Filter out files that are already in the database
   */
  private async filterNewFiles(files: any[]): Promise<any[]> {
    // Get all existing fileIds from the database
    // Assuming we have a table named 'drive_images'
    // This is a placeholder - adjust based on your actual database schema
    const existingRecords = await db.query.driveImages?.findMany({
      columns: { fileId: true }
    }) || [];
    
    const existingFileIds = new Set(existingRecords.map((r: any) => r.fileId));
    
    return files.filter(file => !existingFileIds.has(file.id));
  }

  /**
   * Process a single image file: download, parse EXIF, upload to R2, save to DB
   */
  private async processImageFile(file: any): Promise<DriveImageMetadata> {
    console.log(`Processing ${file.name} (${file.id})`);
    
    // 1. Download the file
    const buffer = await this.downloadFile(file.id);
    
    // 2. Parse EXIF metadata
    const exifData = await this.parseExifMetadata(buffer);

    // 3. Upload to R2
    const r2Info = await this.uploadToR2(buffer, file);

    // 4. Prepare metadata with date fallback
    // Prefer DateTimeOriginal from EXIF, fallback to Drive createdTime
    const captureDate = exifData.date || new Date(file.createdTime);

    const metadata: DriveImageMetadata = {
      fileId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: parseInt(file.size) || 0,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      lat: exifData.lat,
      lon: exifData.lon,
      date: captureDate,
      device: exifData.device,
      r2Url: r2Info.url,
      r2Key: r2Info.key,
    };
    
    // 5. Save to database
    await this.saveToDatabase(metadata);
    
    return metadata;
  }

  /**
   * Download file from Google Drive as ArrayBuffer
   */
  private async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const response = await this.drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    );
    
    return response.data as ArrayBuffer;
  }

  /**
   * Parse EXIF metadata from image buffer
   * Note: exifr returns GPS coordinates as decimal degrees already
   */
  private async parseExifMetadata(buffer: ArrayBuffer): Promise<{
    lat?: number;
    lon?: number;
    date?: Date;
    device?: string;
  }> {
    try {
      // Parse only GPS and TIFF/Exif blocks for performance
      const exif = await exifr.parse(buffer, {
        gps: true,
        tiff: true,
        xmp: false,
        icc: false,
        iptc: false,
        jfif: false,
        // Extract specific tags
        pick: ['latitude', 'longitude', 'DateTimeOriginal', 'Make', 'Model',
               'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef']
      });

      // exifr returns coordinates as decimal degrees
      // However, some formats may need conversion
      let lat: number | undefined;
      let lon: number | undefined;

      if (exif?.latitude !== undefined && exif?.longitude !== undefined) {
        // exifr already converts to decimal degrees
        lat = typeof exif.latitude === 'number' ? exif.latitude : undefined;
        lon = typeof exif.longitude === 'number' ? exif.longitude : undefined;
      } else if (exif?.GPSLatitude && exif?.GPSLongitude) {
        // Fallback: manual conversion if raw DMS data is present
        lat = this.convertDMSToDecimal(exif.GPSLatitude, exif.GPSLatitudeRef || 'N');
        lon = this.convertDMSToDecimal(exif.GPSLongitude, exif.GPSLongitudeRef || 'E');
      }

      // Normalize date - prefer DateTimeOriginal
      let date: Date | undefined;
      if (exif?.DateTimeOriginal) {
        date = new Date(exif.DateTimeOriginal);
        // Validate date
        if (isNaN(date.getTime())) {
          date = undefined;
        }
      }

      // Device information
      let device: string | undefined;
      if (exif?.Make || exif?.Model) {
        device = [exif.Make, exif.Model].filter(Boolean).join(' ').trim();
      }

      return { lat, lon, date, device };
    } catch (error) {
      console.warn('EXIF parsing failed:', error);
      return {};
    }
  }

  /**
   * Convert DMS (Degrees Minutes Seconds) to Decimal Degrees
   * Handles both array format [degrees, minutes, seconds] and object format
   */
  private convertDMSToDecimal(
    dms: { degrees: number; minutes: number; seconds: number } | number | number[],
    ref: string
  ): number {
    // If it's already a number, return it
    if (typeof dms === 'number') {
      return dms;
    }

    let decimal: number;

    // Handle array format [degrees, minutes, seconds]
    if (Array.isArray(dms)) {
      const [degrees = 0, minutes = 0, seconds = 0] = dms;
      decimal = degrees + (minutes / 60) + (seconds / 3600);
    } else {
      // Handle object format
      decimal = dms.degrees + (dms.minutes / 60) + (dms.seconds / 3600);
    }

    // Apply direction reference
    if (ref === 'S' || ref === 'W') {
      return -decimal;
    }
    return decimal;
  }

  /**
   * Upload image to R2 storage
   */
  private async uploadToR2(buffer: ArrayBuffer, file: any): Promise<{ url: string; key: string }> {
    // Convert ArrayBuffer to Node.js Buffer
    const nodeBuffer = Buffer.from(buffer);

    // Upload to R2 using the existing uploadToR2 function
    const result = await uploadToR2({
      fileName: file.name,
      buffer: nodeBuffer,
      mimetype: file.mimeType,
      path: 'drive-ingestion/' // Store in a specific folder
    });

    return result;
  }

  /**
   * Save metadata to database using Drizzle ORM
   */
  private async saveToDatabase(metadata: DriveImageMetadata): Promise<void> {
    await db.insert(driveImages).values({
      fileId: metadata.fileId,
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: metadata.size,
      driveCreatedTime: new Date(metadata.createdTime),
      driveModifiedTime: new Date(metadata.modifiedTime),
      latitude: metadata.lat?.toString(),
      longitude: metadata.lon?.toString(),
      captureDate: metadata.date,
      device: metadata.device,
      r2Url: metadata.r2Url,
      r2Key: metadata.r2Key,
      // processedAt is set automatically by defaultNow()
    });

    console.log(`✓ Saved ${metadata.name} to database`);
  }
}
