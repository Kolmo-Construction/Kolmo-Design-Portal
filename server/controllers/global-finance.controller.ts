// server/controllers/global-finance.controller.ts
import type { Request, Response } from "express";
import { storage } from "@server/storage";
import { log as logger } from '@server/vite';

/**
 * GET /api/invoices - Get all invoices across all projects (admin only)
 */
export async function getAllInvoices(req: Request, res: Response) {
  try {
    logger('[GlobalFinanceController] Fetching all invoices across projects', 'GlobalFinanceController');
    
    const invoices = await storage.invoices.getAllInvoices();
    
    logger(`[GlobalFinanceController] Retrieved ${invoices.length} invoices`, 'GlobalFinanceController');
    res.json(invoices);
  } catch (error) {
    logger(`[GlobalFinanceController] Error fetching all invoices: ${error}`, 'GlobalFinanceController');
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
}

/**
 * GET /api/payments - Get all payments across all invoices (admin only)
 */
export async function getAllPayments(req: Request, res: Response) {
  try {
    logger('[GlobalFinanceController] Fetching all payments across invoices', 'GlobalFinanceController');
    
    const payments = await storage.payments.getAllPayments();
    
    logger(`[GlobalFinanceController] Retrieved ${payments.length} payments`, 'GlobalFinanceController');
    res.json(payments);
  } catch (error) {
    logger(`[GlobalFinanceController] Error fetching all payments: ${error}`, 'GlobalFinanceController');
    res.status(500).json({ error: "Failed to fetch payments" });
  }
}

/**
 * GET /api/milestones - Get all milestones across all projects (admin only)
 */
export async function getAllMilestones(req: Request, res: Response) {
  try {
    logger('[GlobalFinanceController] Fetching all milestones across projects', 'GlobalFinanceController');
    
    const milestones = await storage.milestones.getAllMilestones();
    
    logger(`[GlobalFinanceController] Retrieved ${milestones.length} milestones`, 'GlobalFinanceController');
    res.json(milestones);
  } catch (error) {
    logger(`[GlobalFinanceController] Error fetching all milestones: ${error}`, 'GlobalFinanceController');
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
}