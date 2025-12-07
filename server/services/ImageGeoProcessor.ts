/**
 * Service for post-processing Drive images with geolocation matching
 * Matches images to projects based on GPS coordinates
 */

import { db } from '../db';
import { driveImages, projects, adminImages } from '@shared/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';

export interface GeoMatchResult {
  imageId: number;
  imageName: string;
  projectId: number | null;
  projectName: string | null;
  distance: number | null; // Distance in meters
  matched: boolean;
}

export class ImageGeoProcessor {
  // Distance threshold in meters - images within this distance are considered a match
  private readonly MATCH_THRESHOLD_METERS = 100;

  /**
   * Process all unprocessed Drive images and match them to projects
   */
  async processAllImages(): Promise<GeoMatchResult[]> {
    console.log('[ImageGeoProcessor] Starting geolocation processing...');

    // Get all Drive images that have GPS coordinates and haven't been migrated yet
    const images = await db.query.driveImages.findMany({
      where: and(
        isNotNull(driveImages.latitude),
        isNotNull(driveImages.longitude),
        eq(driveImages.migrated, false)
      ),
    });

    console.log(`[ImageGeoProcessor] Found ${images.length} unmigrated images with GPS coordinates`);

    // Get all projects that have GPS coordinates
    const projectsList = await db.query.projects.findMany({
      where: and(
        isNotNull(projects.latitude),
        isNotNull(projects.longitude)
      ),
      columns: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
      },
    });

    console.log(`[ImageGeoProcessor] Found ${projectsList.length} projects with GPS coordinates`);

    const results: GeoMatchResult[] = [];

    // Process each image
    for (const image of images) {
      const result = await this.processImage(image, projectsList);
      results.push(result);
    }

    console.log(`[ImageGeoProcessor] Processing complete. Matched ${results.filter(r => r.matched).length} / ${results.length} images`);

    return results;
  }

  /**
   * Process a single image and find the closest project
   */
  private async processImage(
    image: any,
    projectsList: any[]
  ): Promise<GeoMatchResult> {
    const imageLat = parseFloat(image.latitude);
    const imageLon = parseFloat(image.longitude);

    let closestProject: any = null;
    let closestDistance = Infinity;

    // Find the closest project
    for (const project of projectsList) {
      const projectLat = parseFloat(project.latitude);
      const projectLon = parseFloat(project.longitude);

      const distance = this.calculateDistance(
        imageLat,
        imageLon,
        projectLat,
        projectLon
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestProject = project;
      }
    }

    // Check if the closest project is within threshold
    const matched = closestDistance <= this.MATCH_THRESHOLD_METERS;

    if (matched && closestProject) {
      console.log(
        `[ImageGeoProcessor] ✓ Matched "${image.name}" to project "${closestProject.name}" (${closestDistance.toFixed(1)}m away)`
      );

      // Migrate image to admin_images table with project assignment
      await this.migrateToAdminImages(image, closestProject.id);
    } else {
      console.log(
        `[ImageGeoProcessor] ✗ No match for "${image.name}" (closest: ${closestDistance !== Infinity ? closestDistance.toFixed(1) + 'm away' : 'no projects with GPS'})`
      );

      // Migrate image to admin_images WITHOUT project assignment (generic folder)
      await this.migrateToAdminImages(image, null);
    }

    return {
      imageId: image.id,
      imageName: image.name,
      projectId: matched ? closestProject.id : null,
      projectName: matched ? closestProject.name : null,
      distance: closestDistance !== Infinity ? closestDistance : null,
      matched,
    };
  }

  /**
   * Migrate a Drive image to the admin_images table with optional project assignment
   */
  private async migrateToAdminImages(driveImage: any, projectId: number | null): Promise<void> {
    try {
      // Create metadata object with EXIF and GPS info
      const metadata = {
        source: 'google-drive',
        driveFileId: driveImage.fileId,
        driveCreatedTime: driveImage.driveCreatedTime,
        driveModifiedTime: driveImage.driveModifiedTime,
        gps: {
          latitude: parseFloat(driveImage.latitude),
          longitude: parseFloat(driveImage.longitude),
        },
        captureDate: driveImage.captureDate,
        device: driveImage.device,
        processedAt: new Date().toISOString(),
      };

      // Generate title from filename or capture date
      const title = driveImage.name.replace(/\.[^/.]+$/, '') ||
                    `Photo ${driveImage.captureDate ? new Date(driveImage.captureDate).toLocaleDateString() : 'Unknown Date'}`;

      // Insert into admin_images
      await db.insert(adminImages).values({
        title,
        description: `Automatically imported from Google Drive. ${driveImage.device ? `Captured with ${driveImage.device}` : ''}`,
        imageUrl: driveImage.r2Url,
        originalFilename: driveImage.name,
        fileSize: driveImage.size,
        mimeType: driveImage.mimeType,
        metadata,
        tags: ['drive-import', driveImage.device ? driveImage.device.toLowerCase().replace(/\s+/g, '-') : null].filter(Boolean),
        category: 'progress', // Categorize as progress photos by default
        projectId, // Associate with matched project
        uploadedById: 1, // System user - adjust as needed
      });

      // Mark the drive_images record as migrated
      await db
        .update(driveImages)
        .set({ migrated: true })
        .where(eq(driveImages.id, driveImage.id));

      console.log(`[ImageGeoProcessor] Migrated "${driveImage.name}" to admin_images ${projectId ? `with project ID ${projectId}` : '(generic folder - no project match)'}`);
    } catch (error) {
      console.error(`[ImageGeoProcessor] Failed to migrate image "${driveImage.name}":`, error);
      throw error;
    }
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * Returns distance in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters

    return distance;
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    totalDriveImages: number;
    imagesWithGPS: number;
    processedImages: number;
    unprocessedImages: number;
  }> {
    const [stats] = await db
      .select({
        totalDriveImages: sql<number>`count(*)`,
        imagesWithGPS: sql<number>`count(*) filter (where latitude is not null and longitude is not null)`,
      })
      .from(driveImages);

    // Count how many have been migrated to admin_images
    // This is a simple heuristic - you may want to add a 'processed' flag to drive_images
    const [migratedCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(adminImages)
      .where(sql`metadata->>'source' = 'google-drive'`);

    return {
      totalDriveImages: Number(stats.totalDriveImages),
      imagesWithGPS: Number(stats.imagesWithGPS),
      processedImages: Number(migratedCount.count),
      unprocessedImages: Number(stats.imagesWithGPS) - Number(migratedCount.count),
    };
  }
}
