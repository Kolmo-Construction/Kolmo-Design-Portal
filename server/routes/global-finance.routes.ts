// server/routes/global-finance.routes.ts
import { Router } from "express";
import * as globalFinanceController from "@server/controllers/global-finance.controller";
import { isAuthenticated, isAdmin } from "@server/middleware/auth.middleware";

const router = Router();

// GET /api/invoices - Get all invoices across all projects (admin only)
router.get("/invoices", isAuthenticated, isAdmin, globalFinanceController.getAllInvoices);

// GET /api/payments - Get all payments across all invoices (admin only)
router.get("/payments", isAuthenticated, isAdmin, globalFinanceController.getAllPayments);

// GET /api/milestones - Get all milestones across all projects (admin only)
router.get("/milestones", isAuthenticated, isAdmin, globalFinanceController.getAllMilestones);

export default router;