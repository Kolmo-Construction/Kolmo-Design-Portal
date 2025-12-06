import { google } from 'googleapis';
import exifr from 'exifr';
import { db } from '../db';
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
    
    // 4. Prepare metadata
    const metadata: DriveImageMetadata = {
      fileId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: parseInt(file.size) || 0,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      lat: exifData.lat,
      lon: exifData.lon,
      date: exifData.date,
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
        pick: ['latitude', 'longitude', 'DateTimeOriginal', 'Make', 'Model']
      });

      // Normalize GPS coordinates
      let lat: number | undefined;
      let lon: number | undefined;
      if (exif?.latitude && exif?.longitude) {
        lat = this.convertDMSToDecimal(exif.latitude, exif.latitudeRef);
        lon = this.convertDMSToDecimal(exif.longitude, exif.longitudeRef);
      }

      // Normalize date
      let date: Date | undefined;
      if (exif?.DateTimeOriginal) {
        date = new Date(exif.DateTimeOriginal);
      }

      // Device information
      let device: string | undefined;
      if (exif?.Make || exif?.Model) {
        device = [exif.Make, exif.Model].filter(Boolean).join(' ');
      }

      return { lat, lon, date, device };
    } catch (error) {
      console.warn('EXIF parsing failed:', error);
      return {};
    }
  }

  /**
   * Convert DMS (Degrees Minutes Seconds) to Decimal Degrees
   */
  private convertDMSToDecimal(
    dms: { degrees: number; minutes: number; seconds: number } | number,
    ref: string
  ): number {
    // If it's already a number, return it
    if (typeof dms === 'number') {
      return dms;
    }
    
    // Calculate decimal degrees
    const decimal = dms.degrees + (dms.minutes / 60) + (dms.seconds / 3600);
    
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
    // Convert ArrayBuffer to Buffer for R2 upload
    const nodeBuffer = Buffer.from(buffer);
    
    // Create a File-like object
    const blob = new Blob([nodeBuffer], { type: file.mimeType });
    const r2File = new File([blob], file.name, { type: file.mimeType });
    
    // Upload to R2 using the existing uploadToR2 function
    // Note: uploadToR2 expects a File object
    const key = await uploadToR2(r2File);
    
    // Construct URL (adjust based on your R2 configuration)
    const url = `https://your-r2-domain.com/${key}`;
    
    return { url, key };
  }

  /**
   * Save metadata to database
   */
  private async saveToDatabase(metadata: DriveImageMetadata): Promise<void> {
    // Insert into the drive_images table
    // Adjust based on your actual database schema
    await db.insert('drive_images').values({
      fileId: metadata.fileId,
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: metadata.size,
      createdTime: new Date(metadata.createdTime),
      modifiedTime: new Date(metadata.modifiedTime),
      lat: metadata.lat,
      lon: metadata.lon,
      captureDate: metadata.date,
      device: metadata.device,
      r2Url: metadata.r2Url,
      r2Key: metadata.r2Key,
      processedAt: new Date(),
    });
  }
}
