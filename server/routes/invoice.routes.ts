// server/routes/invoice.routes.ts
import { Router } from "express";
import * as invoiceController from "@server/controllers/invoice.controller"; // Updated import
import { isAuthenticated, isAdmin } from "@server/middleware/auth.middleware"; // Updated import
import { requireProjectPermission } from "@server/middleware/enhanced-permissions.middleware";

// Use mergeParams: true to access :projectId from the parent router mount point
const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/invoices/
// Requires view invoices permission
router.get("/", isAuthenticated, requireProjectPermission('canViewInvoices'), invoiceController.getInvoicesForProject);

// POST /api/projects/:projectId/invoices/
// Requires create invoices permission (Admin or Project Manager)
router.post("/", isAuthenticated, requireProjectPermission('canCreateInvoices'), invoiceController.createInvoice);

// POST /api/projects/:projectId/invoices/:invoiceId/send
// Send a draft invoice to the customer (Project Manager access)
router.post(
  "/:invoiceId/send",
  isAuthenticated,
  requireProjectPermission('canSendInvoices'),
  invoiceController.sendInvoice
);

// GET /api/projects/:projectId/invoices/:invoiceId/download
// Download invoice as PDF
router.get(
  "/:invoiceId/download",
  isAuthenticated,
  requireProjectPermission('canViewInvoices'),
  invoiceController.downloadInvoicePdf
);

// GET /api/projects/:projectId/invoices/:invoiceId/view
// Get invoice details for viewing
router.get(
  "/:invoiceId/view",
  isAuthenticated,
  requireProjectPermission('canViewInvoices'),
  invoiceController.getInvoiceDetails
);

export default router;