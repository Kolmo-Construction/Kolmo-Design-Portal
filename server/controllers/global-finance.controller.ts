// server/controllers/global-finance.controller.ts
import { Request, Response, NextFunction } from "express";
import { storage } from "@server/storage";
import { HttpError } from "@server/errors";
import type { User } from "@shared/schema";

/**
 * Get all invoices across all projects (admin only)
 */
export const getAllInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as User;
    
    if (!user || user.role !== 'admin') {
      throw new HttpError(403, 'Admin access required');
    }

    const invoices = await storage.invoices.getAllInvoices();
    res.status(200).json(invoices);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all payments across all invoices (admin only)
 */
export const getAllPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as User;
    
    if (!user || user.role !== 'admin') {
      throw new HttpError(403, 'Admin access required');
    }

    const payments = await storage.payments.getAllPayments();
    res.status(200).json(payments);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all milestones across all projects (admin only)
 */
export const getAllMilestones = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as User;
    
    if (!user || user.role !== 'admin') {
      throw new HttpError(403, 'Admin access required');
    }

    const milestones = await storage.milestones.getAllMilestones();
    res.status(200).json(milestones);
  } catch (error) {
    next(error);
  }
};