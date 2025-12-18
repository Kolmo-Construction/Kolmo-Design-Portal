import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware';
import { getUnifiedContent } from '../controllers/unified-content.controller';

const router = Router({ mergeParams: true });

/**
 * Unified Content Routes
 *
 * These routes provide a single endpoint to fetch all content types for a project
 * in a normalized format, simplifying the frontend implementation.
 *
 * Base path: /api/projects/:projectId/unified-content
 */

// GET /api/projects/:projectId/unified-content
// Get all content for a project (progress updates, images, invoices, etc.)
// Query params: contentType, status, visibility
router.get('/', isAuthenticated, getUnifiedContent);

export { router as unifiedContentRoutes };
