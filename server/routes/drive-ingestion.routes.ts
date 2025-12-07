/**
 * API routes for Google Drive image ingestion
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createDriveService } from '../services/drive-service-factory';
import { ImageGeoProcessor } from '../services/ImageGeoProcessor';
import { isAdmin } from '../auth'; // Assuming admin middleware exists
import { HttpError } from '../errors';

const router = Router();

/**
 * POST /api/drive-ingestion/trigger
 * Trigger a new Drive ingestion run
 * Admin only
 * Query params:
 *   - autoProcess=true: Automatically run geolocation matching after ingestion
 */
router.post('/trigger', isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[Drive Ingestion] Trigger requested by user:', req.user?.id);

    const autoProcess = req.query.autoProcess === 'true';

    // Create service
    const service = await createDriveService();

    // Run ingestion
    const startTime = Date.now();
    const results = await service.ingestNewImages();
    const duration = Date.now() - startTime;

    console.log(`[Drive Ingestion] Completed in ${duration}ms. Processed ${results.length} images.`);

    // Optionally run geolocation processing
    let geoResults = null;
    if (autoProcess && results.length > 0) {
      console.log('[Drive Ingestion] Running automatic geolocation processing...');
      const processor = new ImageGeoProcessor();
      geoResults = await processor.processAllImages();

      const matched = geoResults.filter(r => r.matched).length;
      console.log(`[Drive Ingestion] Geo-processing complete: ${matched}/${geoResults.length} images matched to projects`);
    }

    // Return results
    res.json({
      success: true,
      message: `Successfully ingested ${results.length} new image(s)${geoResults ? `. ${geoResults.filter(r => r.matched).length} matched to projects` : ''}`,
      data: {
        count: results.length,
        duration: duration,
        images: results.map(img => ({
          fileId: img.fileId,
          name: img.name,
          size: img.size,
          hasGPS: !!(img.lat && img.lon),
          latitude: img.lat,
          longitude: img.lon,
          captureDate: img.date,
          device: img.device,
          r2Url: img.r2Url,
        })),
        geoProcessing: geoResults ? {
          total: geoResults.length,
          matched: geoResults.filter(r => r.matched).length,
          unmatched: geoResults.length - geoResults.filter(r => r.matched).length,
        } : null,
      },
    });
  } catch (error) {
    console.error('[Drive Ingestion] Error:', error);

    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('credentials')) {
        throw new HttpError(500, 'Drive service not configured. Missing credentials.');
      } else if (error.message.includes('permission') || error.message.includes('403')) {
        throw new HttpError(403, 'Access denied to Google Drive. Check service account permissions.');
      }
    }

    next(error);
  }
});

/**
 * GET /api/drive-ingestion/status
 * Get status of Drive ingestion service
 * Admin only
 */
router.get('/status', isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { db } = await import('../db');
    const { driveImages } = await import('@shared/schema');
    const { sql } = await import('drizzle-orm');

    // Get statistics from database
    const stats = await db
      .select({
        totalImages: sql<number>`count(*)`,
        withGPS: sql<number>`count(*) filter (where latitude is not null and longitude is not null)`,
        withDevice: sql<number>`count(*) filter (where device is not null)`,
        lastProcessed: sql<Date>`max(processed_at)`,
      })
      .from(driveImages);

    const stat = stats[0];

    res.json({
      success: true,
      data: {
        totalImages: Number(stat.totalImages),
        imagesWithGPS: Number(stat.withGPS),
        imagesWithDevice: Number(stat.withDevice),
        lastProcessedAt: stat.lastProcessed,
        serviceAccount: 'dirve-poller@kolmo-design-images.iam.gserviceaccount.com',
      },
    });
  } catch (error) {
    console.error('[Drive Ingestion] Status error:', error);
    next(error);
  }
});

/**
 * GET /api/drive-ingestion/images
 * List ingested images
 * Admin only
 */
router.get('/images', isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { db } = await import('../db');
    const { driveImages } = await import('@shared/schema');
    const { desc } = await import('drizzle-orm');

    // Get query params
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Query images
    const images = await db
      .select()
      .from(driveImages)
      .orderBy(desc(driveImages.processedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: {
        images: images.map(img => ({
          id: img.id,
          fileId: img.fileId,
          name: img.name,
          size: img.size,
          latitude: img.latitude ? parseFloat(img.latitude) : null,
          longitude: img.longitude ? parseFloat(img.longitude) : null,
          captureDate: img.captureDate,
          device: img.device,
          r2Url: img.r2Url,
          processedAt: img.processedAt,
        })),
        pagination: {
          limit,
          offset,
          hasMore: images.length === limit,
        },
      },
    });
  } catch (error) {
    console.error('[Drive Ingestion] List images error:', error);
    next(error);
  }
});

/**
 * POST /api/drive-ingestion/process-geo
 * Process Drive images and match them to projects based on GPS coordinates
 * Admin only
 */
router.post('/process-geo', isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[Drive Ingestion] Starting geolocation processing...');

    const processor = new ImageGeoProcessor();
    const results = await processor.processAllImages();

    const matched = results.filter(r => r.matched).length;
    const unmatched = results.length - matched;

    res.json({
      success: true,
      message: `Processed ${results.length} images: ${matched} matched, ${unmatched} unmatched`,
      data: {
        total: results.length,
        matched,
        unmatched,
        results: results.map(r => ({
          imageName: r.imageName,
          projectName: r.projectName,
          distance: r.distance ? Math.round(r.distance) : null,
          matched: r.matched,
        })),
      },
    });
  } catch (error) {
    console.error('[Drive Ingestion] Geo processing error:', error);
    next(error);
  }
});

/**
 * GET /api/drive-ingestion/process-stats
 * Get statistics about image processing
 * Admin only
 */
router.get('/process-stats', isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const processor = new ImageGeoProcessor();
    const stats = await processor.getProcessingStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Drive Ingestion] Stats error:', error);
    next(error);
  }
});

export default router;
