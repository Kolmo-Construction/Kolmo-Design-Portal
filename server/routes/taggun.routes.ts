import { Router } from 'express';
import { TaggunController } from '../controllers/taggun.controller';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware';

const router = Router();

// Get Taggun configuration status
router.get('/status', isAuthenticated, TaggunController.getStatus);

// Get receipts for a specific project
router.get('/receipts/:projectId', isAuthenticated, TaggunController.getProjectReceipts);

// Scan receipt for a project
router.post('/projects/:projectId/scan', isAuthenticated, TaggunController.scanReceipt);

export default router;
