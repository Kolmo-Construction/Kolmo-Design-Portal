// server/routes/receipt.routes.ts

/**
 * Receipt Routes
 * Endpoints for receipt uploads, OCR processing, and expense tracking
 */

import { Router } from 'express';
import { receiptController } from '../controllers/receipt.controller';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/projects/:projectId/receipts
 * Upload a receipt for a project with OCR processing
 * Multipart form data:
 * - file: image file (JPG, PNG, PDF)
 * - category: materials|labor|equipment|other (optional)
 * - notes: text (optional)
 */
router.post(
  '/projects/:projectId/receipts',
  isAuthenticated,
  receiptController.upload.single('file'),
  receiptController.uploadReceipt
);

/**
 * GET /api/projects/:projectId/receipts
 * Get all receipts for a project
 * Query params: startDate, endDate, category, isVerified
 */
router.get(
  '/projects/:projectId/receipts',
  isAuthenticated,
  receiptController.getReceipts
);

/**
 * GET /api/receipts
 * Get receipts for current user (across all projects)
 * Query params: startDate, endDate, category, isVerified
 */
router.get(
  '/receipts',
  isAuthenticated,
  receiptController.getReceipts
);

/**
 * GET /api/receipts/:id
 * Get single receipt by ID
 */
router.get(
  '/receipts/:id',
  isAuthenticated,
  receiptController.getReceipt
);

/**
 * PATCH /api/receipts/:id
 * Update receipt metadata
 * Body: vendorName, totalAmount, receiptDate, category, notes
 */
router.patch(
  '/receipts/:id',
  isAuthenticated,
  receiptController.updateReceipt
);

/**
 * DELETE /api/receipts/:id
 * Delete a receipt (uploader or admin only)
 */
router.delete(
  '/receipts/:id',
  isAuthenticated,
  receiptController.deleteReceipt
);

/**
 * POST /api/receipts/:id/verify
 * Mark a receipt as verified (admin/PM only)
 */
router.post(
  '/receipts/:id/verify',
  isAuthenticated,
  receiptController.verifyReceipt
);

/**
 * GET /api/projects/:projectId/expenses
 * Get expense summary for a project
 * Returns totals by category, vendor, and verification status
 */
router.get(
  '/projects/:projectId/expenses',
  isAuthenticated,
  receiptController.getExpenseSummary
);

export default router;
