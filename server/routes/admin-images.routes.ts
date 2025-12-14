// server/routes/admin-images.routes.ts
import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload.middleware';
import { isAuthenticated, AuthenticatedRequest } from '../middleware/auth.middleware';
import { AdminImagesController } from '../controllers/admin-images.controller';

const router = Router();
const adminImagesController = new AdminImagesController();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

/**
 * GET /api/admin/images/stats
 * Get image statistics and analytics (must be before /:id route)
 */
router.get('/stats', (req, res) => adminImagesController.getImageStats(req as AuthenticatedRequest, res));

/**
 * POST /api/admin/images/process-unassigned
 * Process unassigned photos and match them to projects using geofencing
 * Admin/PM only - scans all photos without project_id and attempts to match based on GPS
 */
router.post('/process-unassigned', (req, res) => adminImagesController.processUnassignedPhotos(req as AuthenticatedRequest, res));

/**
 * POST /api/admin/images
 * Upload multiple images with metadata and tagging
 */
router.post('/', upload.array('image', 10), (req, res) => adminImagesController.uploadImages(req as AuthenticatedRequest, res));

/**
 * GET /api/admin/images
 * Get all admin images with filtering and pagination
 * Query params: page, limit, category, projectId, tags, search
 */
router.get('/', (req, res) => adminImagesController.getImages(req as AuthenticatedRequest, res));

/**
 * PUT /api/admin/images/:id
 * Update image metadata and tags
 */
router.put('/:id', (req, res) => adminImagesController.updateImage(req as AuthenticatedRequest, res));

/**
 * DELETE /api/admin/images/:id
 * Delete an image
 */
router.delete('/:id', (req, res) => adminImagesController.deleteImage(req as AuthenticatedRequest, res));

export { router as adminImagesRoutes };