import { Request, Response } from 'express';
import { taggunService } from '../services/taggun.service';

export class TaggunController {
  /**
   * Get Taggun configuration status
   */
  static async getStatus(req: Request, res: Response) {
    try {
      const status = taggunService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting Taggun status:', error);
      res.status(500).json({
        configured: false,
        connected: false,
        message: 'Failed to get Taggun status',
      });
    }
  }

  /**
   * Get receipts for a specific project
   */
  static async getProjectReceipts(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);

      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      const receipts = await taggunService.getProjectReceipts(projectId);

      // Calculate summary statistics
      const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
      const averageConfidence = receipts.length > 0
        ? receipts.reduce((sum, r) => sum + r.confidence, 0) / receipts.length
        : 0;

      res.json({
        receipts,
        totalAmount,
        averageConfidence,
      });
    } catch (error) {
      console.error('Error fetching project receipts:', error);
      res.status(500).json({
        error: 'Failed to fetch project receipts',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Scan a receipt image for a project
   */
  static async scanReceipt(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);

      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      // Check if file was uploaded
      if (!req.file && !req.files) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please upload a receipt image'
        });
      }

      // For now, return a placeholder response
      // TODO: Implement actual Taggun API integration
      res.json({
        success: true,
        message: 'Receipt scanning is not yet fully implemented',
        receipt: {
          id: 'placeholder',
          projectId,
          amount: 0,
          merchant: 'Unknown',
          date: new Date().toISOString(),
          category: 'Uncategorized',
          confidence: 0,
          status: 'pending',
        },
      });
    } catch (error) {
      console.error('Error scanning receipt:', error);
      res.status(500).json({
        error: 'Failed to scan receipt',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
