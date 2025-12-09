// server/controllers/receipt.controller.ts

/**
 * Receipt Controller
 * Handles receipt uploads, OCR processing, and expense tracking
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { receiptRepository } from '../storage/repositories/receipt.repository';
import { geminiReceiptService } from '../services/gemini-receipt.service';
import { uploadToR2 } from '../r2-upload';

// Validation schemas
const uploadReceiptSchema = z.object({
  projectId: z.string().transform(val => parseInt(val)),
  category: z.enum(['materials', 'labor', 'equipment', 'other']).optional(),
  notes: z.string().optional(),
});

const updateReceiptSchema = z.object({
  vendorName: z.string().optional(),
  totalAmount: z.number().optional(),
  receiptDate: z.string().transform(val => new Date(val)).optional(),
  category: z.enum(['materials', 'labor', 'equipment', 'other']).optional(),
  notes: z.string().optional(),
});

const getReceiptsSchema = z.object({
  projectId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  category: z.string().optional(),
  isVerified: z.string().optional().transform(val => val === 'true'),
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs only
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image files and PDFs are allowed'));
    }
  },
});

/**
 * Receipt Controller Class
 */
export class ReceiptController {
  public upload = upload;

  constructor() {
    // Bind methods to ensure proper 'this' context
    this.uploadReceipt = this.uploadReceipt.bind(this);
    this.getReceipts = this.getReceipts.bind(this);
    this.getReceipt = this.getReceipt.bind(this);
    this.updateReceipt = this.updateReceipt.bind(this);
    this.deleteReceipt = this.deleteReceipt.bind(this);
    this.verifyReceipt = this.verifyReceipt.bind(this);
    this.getExpenseSummary = this.getExpenseSummary.bind(this);
  }

  /**
   * POST /api/projects/:projectId/receipts
   * Upload and scan a receipt
   */
  async uploadReceipt(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Check if file was uploaded
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }

      // Get projectId from URL params
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        res.status(400).json({ success: false, message: 'Invalid project ID' });
        return;
      }

      // Get category and notes from body
      const category = req.body.category as string | undefined;
      const notes = req.body.notes as string | undefined;

      // Upload image to R2
      console.log('[Receipt] Uploading image to R2...');
      const uploadResult = await uploadToR2({
        fileName: req.file.originalname,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        path: `receipts/project-${projectId}/`,
      });

      console.log('[Receipt] Image uploaded to R2:', uploadResult.key);

      // Scan receipt with Gemini
      console.log('[Receipt] Scanning receipt with Gemini 2.0...');
      const scanResult = await geminiReceiptService.scanReceipt(
        req.file.buffer,
        req.file.originalname
      );

      if (!scanResult.success) {
        console.error('[Receipt] Gemini scan failed:', scanResult.error);
        // Continue anyway and save the receipt without OCR data
      } else {
        console.log('[Receipt] Gemini scan successful:', {
          vendor: scanResult.vendorName,
          amount: scanResult.totalAmount,
          confidence: scanResult.ocrConfidence,
        });
      }

      // Create receipt record in database
      const receipt = await receiptRepository.create({
        projectId,
        uploadedBy: user.id,
        vendorName: scanResult.vendorName,
        totalAmount: scanResult.totalAmount?.toString() || null,
        currency: scanResult.currency,
        receiptDate: scanResult.receiptDate,
        category: category || null,
        tags: [],
        notes: notes || null,
        imageUrl: uploadResult.url,
        imageKey: uploadResult.key,
        ocrData: scanResult.ocrData,
        ocrConfidence: scanResult.ocrConfidence?.toString() || null,
        ocrProcessedAt: scanResult.success ? new Date() : null,
        isVerified: false,
        verifiedBy: null,
        verifiedAt: null,
      });

      // Fetch complete receipt with relations
      const completeReceipt = await receiptRepository.findById(receipt.id);

      res.status(201).json({
        success: true,
        message: 'Receipt uploaded successfully',
        receipt: completeReceipt,
        ocr: {
          success: scanResult.success,
          confidence: scanResult.ocrConfidence,
          error: scanResult.error,
        },
      });
    } catch (error: any) {
      console.error('Error in uploadReceipt controller:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error while uploading receipt',
      });
    }
  }

  /**
   * GET /api/receipts or /api/projects/:projectId/receipts
   * Get receipts with optional filters
   */
  async getReceipts(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Get projectId from URL params first (for /projects/:projectId/receipts route)
      const projectIdFromUrl = req.params.projectId
        ? parseInt(req.params.projectId)
        : undefined;

      // Validate query parameters
      const validationResult = getReceiptsSchema.safeParse(req.query);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: validationResult.error.errors,
        });
        return;
      }

      const { projectId: projectIdFromQuery, startDate, endDate, category, isVerified } = validationResult.data;

      // Use URL param if available, otherwise use query param
      const projectId = projectIdFromUrl || projectIdFromQuery;

      let receipts;
      if (projectId) {
        // Get receipts for specific project
        receipts = await receiptRepository.findByProjectId(projectId, {
          startDate,
          endDate,
          category,
          isVerified,
        });
      } else if (user.role === 'admin' || user.role === 'projectManager') {
        // Admins and PMs can see all receipts (would need to implement this)
        res.status(400).json({
          success: false,
          message: 'projectId is required',
        });
        return;
      } else {
        // Regular users can only see their uploaded receipts
        receipts = await receiptRepository.findByUploader(user.id, {
          startDate,
          endDate,
          category,
          isVerified,
        });
      }

      res.status(200).json({
        success: true,
        receipts,
      });
    } catch (error: any) {
      console.error('Error in getReceipts controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching receipts',
      });
    }
  }

  /**
   * GET /api/receipts/:id
   * Get single receipt by ID
   */
  async getReceipt(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const receiptId = parseInt(req.params.id);
      if (isNaN(receiptId)) {
        res.status(400).json({ success: false, message: 'Invalid receipt ID' });
        return;
      }

      const receipt = await receiptRepository.findById(receiptId);

      if (!receipt) {
        res.status(404).json({ success: false, message: 'Receipt not found' });
        return;
      }

      // Check permissions (user must be uploader, admin, or PM)
      if (
        receipt.uploadedBy !== user.id &&
        user.role !== 'admin' &&
        user.role !== 'projectManager'
      ) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }

      res.status(200).json({
        success: true,
        receipt,
      });
    } catch (error: any) {
      console.error('Error in getReceipt controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching receipt',
      });
    }
  }

  /**
   * PATCH /api/receipts/:id
   * Update receipt metadata
   */
  async updateReceipt(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const receiptId = parseInt(req.params.id);
      if (isNaN(receiptId)) {
        res.status(400).json({ success: false, message: 'Invalid receipt ID' });
        return;
      }

      // Validate request body
      const validationResult = updateReceiptSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors,
        });
        return;
      }

      // Check if receipt exists
      const existingReceipt = await receiptRepository.findById(receiptId);
      if (!existingReceipt) {
        res.status(404).json({ success: false, message: 'Receipt not found' });
        return;
      }

      // Check permissions
      if (
        existingReceipt.uploadedBy !== user.id &&
        user.role !== 'admin' &&
        user.role !== 'projectManager'
      ) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }

      // Update receipt
      const updateData = {
        ...validationResult.data,
        totalAmount: validationResult.data.totalAmount?.toString(),
      };

      const updatedReceipt = await receiptRepository.update(receiptId, updateData);

      res.status(200).json({
        success: true,
        message: 'Receipt updated successfully',
        receipt: updatedReceipt,
      });
    } catch (error: any) {
      console.error('Error in updateReceipt controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while updating receipt',
      });
    }
  }

  /**
   * DELETE /api/receipts/:id
   * Delete a receipt
   */
  async deleteReceipt(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const receiptId = parseInt(req.params.id);
      if (isNaN(receiptId)) {
        res.status(400).json({ success: false, message: 'Invalid receipt ID' });
        return;
      }

      // Check if receipt exists
      const receipt = await receiptRepository.findById(receiptId);
      if (!receipt) {
        res.status(404).json({ success: false, message: 'Receipt not found' });
        return;
      }

      // Check permissions (only uploader or admin can delete)
      if (receipt.uploadedBy !== user.id && user.role !== 'admin') {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }

      // Delete receipt
      await receiptRepository.delete(receiptId);

      // TODO: Also delete the image from R2 (optional enhancement)

      res.status(200).json({
        success: true,
        message: 'Receipt deleted successfully',
      });
    } catch (error: any) {
      console.error('Error in deleteReceipt controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while deleting receipt',
      });
    }
  }

  /**
   * POST /api/receipts/:id/verify
   * Mark a receipt as verified (admin/PM only)
   */
  async verifyReceipt(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Only admins and PMs can verify receipts
      if (user.role !== 'admin' && user.role !== 'projectManager') {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }

      const receiptId = parseInt(req.params.id);
      if (isNaN(receiptId)) {
        res.status(400).json({ success: false, message: 'Invalid receipt ID' });
        return;
      }

      // Check if receipt exists
      const receipt = await receiptRepository.findById(receiptId);
      if (!receipt) {
        res.status(404).json({ success: false, message: 'Receipt not found' });
        return;
      }

      // Verify receipt
      const updatedReceipt = await receiptRepository.update(receiptId, {
        isVerified: true,
        verifiedBy: user.id,
        verifiedAt: new Date(),
      });

      res.status(200).json({
        success: true,
        message: 'Receipt verified successfully',
        receipt: updatedReceipt,
      });
    } catch (error: any) {
      console.error('Error in verifyReceipt controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while verifying receipt',
      });
    }
  }

  /**
   * GET /api/projects/:projectId/expenses
   * Get expense summary for a project
   */
  async getExpenseSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        res.status(400).json({ success: false, message: 'Invalid project ID' });
        return;
      }

      const summary = await receiptRepository.getExpenseSummary(projectId);

      res.status(200).json({
        success: true,
        summary,
      });
    } catch (error: any) {
      console.error('Error in getExpenseSummary controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching expense summary',
      });
    }
  }
}

// Export singleton instance
export const receiptController = new ReceiptController();
