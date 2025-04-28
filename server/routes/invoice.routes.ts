// server/routes/invoice.routes.ts
import { Router } from "express";
import * as invoiceController from "@server/controllers/invoice.controller"; // Updated import
import { isAuthenticated, isAdmin } from "@server/middleware/auth.middleware"; // Updated import
// Import checkProjectAccess if applying as middleware
// import { checkProjectAccess } from "../middleware/permissions.middleware";

// Use mergeParams: true to access :projectId from the parent router mount point
const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/invoices/
// Requires authentication. Access check happens within the controller currently.
// Alternatively, apply checkProjectAccess middleware here.
router.get("/", isAuthenticated, invoiceController.getInvoicesForProject);

// POST /api/projects/:projectId/invoices/
// Requires Admin privileges (which implies authentication).
router.post("/", isAdmin, invoiceController.createInvoice);

export default router;