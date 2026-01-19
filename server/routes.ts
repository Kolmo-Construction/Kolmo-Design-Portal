// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Router } from "express"; // Keep Router for potential future use or other routes defined here

// Import middleware
import { isAuthenticated, isAdmin, requireWebAccess } from "@server/middleware/auth.middleware";
import { validateApiKey } from "@server/middleware/apikey.middleware";
import { validateProjectId } from "@server/middleware/validation.middleware";
// Import Schemas/Types if needed for other routes defined in this file
import { User } from "@shared/schema";

// --- Core Auth Setup ---
import { setupAuth } from "@server/auth";

// --- Import Feature Routers ---
import authRouter from "@server/routes/auth.routes";
import mobileAuthRouter from "@server/routes/mobile-auth.routes";
import projectRouter from "@server/routes/project.routes";
import { projectDocumentRouter, globalDocumentRouter } from "@server/routes/document.routes";
import invoiceRouter from "@server/routes/invoice.routes";
import messageRouter from "@server/routes/message.routes";
import progressUpdateRouter from "@server/routes/progressUpdate.routes";
import taskRouterModule from "@server/routes/task.routes";
import dailyLogRouter from "@server/routes/dailyLog.routes"; // Assuming you have this file
import punchListRouter from "@server/routes/punchList.routes"; // Assuming you have this file
import ragRouter from "./routes/rag-routes"; // RAG system router
import quoteRouter from "./routes/quote.routes"; // Quote system router
import quoteAnalyticsRouter from "./routes/quote-analytics.routes"; // Quote analytics router
import { paymentRoutes } from "./routes/payment.routes"; // Payment processing router
import { webhookRoutes } from "./routes/webhook.routes"; // Stripe webhook router
import { projectPaymentRoutes } from "./routes/project-payment.routes"; // Project payment summary router
import globalFinanceRoutes from "./routes/global-finance.routes"; // Global finance API routes
import taskBillingRouter from "./routes/task-billing.routes"; // Task billing router for complete-and-bill functionality
import { milestoneRoutes } from "./routes/milestone.routes"; // Milestone management router
import { unifiedContentRoutes } from "./routes/unified-content.routes"; // Unified content API router
import clientRouter from "./routes/client.routes"; // Client portal router
import billingValidationRouter from "./routes/billing-validation.routes"; // Billing validation router
import { adminImagesRoutes } from "./routes/admin-images.routes"; // Admin image gallery router
import driveIngestionRouter from "./routes/drive-ingestion.routes"; // Google Drive ingestion router
import designProposalRouter from "./routes/design-proposal.routes"; // Design proposal router
import apiKeyRouter from "./routes/apikey.routes"; // API key management router
import timeTrackingRouter from "./routes/timetracking.routes"; // Time tracking router
import receiptRouter from "./routes/receipt.routes"; // Receipt scanning router
import userRouter from "./routes/user.routes"; // User management router

import { storageRoutes } from "./routes/storage-routes"; // Storage/R2 router
import chatRouter from "./routes/chat.routes"; // Stream Chat router
import agentRouter from "./routes/agent.routes"; // AI Agent router
import leadRouter from "./routes/lead.routes"; // Lead management router
import interviewRouter from "./routes/interview.routes"; // AI Interview Mode router
import ttsRouter from "./routes/tts.routes"; // Text-to-Speech router
// Import other routers as needed (milestones, selections, admin, etc.)
// import milestoneRouter from "@server/routes/milestone.routes";
// import selectionRouter from "@server/routes/selection.routes";
// import adminRouter from "@server/routes/admin.routes";

// Define interfaces for request params if needed for routes defined *in this file*
// interface ParamsDictionary { [key: string]: string; }
// interface ProjectParams extends ParamsDictionary { projectId: string; }
// ... other param types ...

// =========================================================================
// Main Route Registration Function
// =========================================================================
export async function registerRoutes(app: Express): Promise<void> { // Changed return type to void

  // --- Core Auth Setup (Session, Passport Init) ---
  // This needs to run early to make req.user available
  setupAuth(app);

  // --- API Key Validation Middleware ---
  // Mount BEFORE other routes to allow API key auth as alternative to session auth
  // This middleware extracts and validates API keys from headers, setting req.user if valid
  app.use(validateApiKey);

  // --- Mount Auth-specific routes (Password Reset, etc.) ---
  // Note: setupAuth likely already added /login, /logout, /api/user etc.
  // This router is for additional auth flows like password reset.
  app.use("/api", authRouter); // Assuming authRouter handles routes like /api/password-reset-request

  // --- Mount Mobile Auth Routes ---
  // Routes for mobile app login with API key generation
  // These routes provide API key-based authentication for mobile apps
  app.use("/api/auth", mobileAuthRouter);

  // --- Mount API Key Management Routes ---
  // Routes for creating, listing, and revoking API keys
  // These routes require session authentication (not API key auth) to manage keys
  app.use("/api/api-keys", apiKeyRouter);

  // --- Mount Time Tracking Routes ---
  // Routes for mobile time tracking with geofencing validation
  // Supports both API key and session authentication
  app.use("/api/time", timeTrackingRouter);

  // --- Mount Receipt Routes ---
  // Routes for receipt uploads and OCR processing with Taggun
  // Supports both API key and session authentication
  app.use("/api", receiptRouter);

  // --- Mount Mobile API Routes (Kolmo Mobile App) ---
  // Mobile-specific route prefix for backward compatibility
  // These routes are accessible via API key authentication (no requireWebAccess)
  app.use("/api/kolmo/projects", isAuthenticated, projectRouter);
  app.use("/api/kolmo/time", timeTrackingRouter);
  app.use("/api/kolmo", receiptRouter);

  // --- Mount Admin Images Routes (Mobile-accessible) ---
  // CRITICAL: Registered EARLY to avoid broad /api middleware with requireWebAccess
  // Mobile app uploads images via API key, authentication checked within routes
  app.use("/api/admin/images", adminImagesRoutes);

  // --- Mount Design Proposal Routes (Mixed auth - public + admin) ---
  // CRITICAL: Registered EARLY to avoid broad /api middleware blocking public endpoints
  // Contains public endpoints for customer access, authentication handled within routes
  app.use("/api/design-proposals", designProposalRouter);

  // --- Mount Storage/R2 Routes (Mixed auth - public proxy, authenticated uploads) ---
  // CRITICAL: Registered EARLY to allow public image access via /api/storage/proxy/*
  // Public proxy endpoint serves images for design proposals without authentication
  app.use("/api/storage", storageRoutes);

  // --- Mount User Management Routes ---
  // Routes for user management and hourly rate configuration
  // Admin only
  app.use("/api/users", userRouter);

  // --- Development-only routes (Example) ---
  if (process.env.NODE_ENV === 'development') {
    // Make sure these routes don't conflict with setupAuth routes
    // Example: app.get("/api/dev/reset-tokens", isAdmin, async (req, res) => { /* ... */ });
    // Example: app.post("/api/dev/create-admin", async (req, res) => { /* ... */ });
  }

  // =========================================================================
  // Resource Routes Mounting
  // =========================================================================

  // --- Mount Project Router ---
  // Base path: /api/projects
  // Middleware: Applied within projectRouter or specific routes there
  app.use("/api/projects", projectRouter);

  // --- Mount Global Document Router ---
  // Base path: /api/documents (Web-only)
  app.use("/api/documents", isAuthenticated, requireWebAccess, globalDocumentRouter);

  // --- Mount Global Admin Routes ---
  // Global invoice access for admins (Web-only)
  app.get("/api/admin/invoices", isAuthenticated, requireWebAccess, isAdmin, async (req: any, res: any, next: any) => {
    const { getAllInvoices } = await import("./controllers/invoice.controller");
    return getAllInvoices(req, res, next);
  });

  // Client invoice access - for both clients and admins (Web-only)
  app.get("/api/client/invoices", isAuthenticated, requireWebAccess, async (req: any, res: any, next: any) => {
    const { getClientInvoices } = await import("./controllers/client.controller");
    return getClientInvoices(req, res, next);
  });

  // Universal invoice access - routes to client or admin based on role (Web-only)
  app.get("/api/invoices", isAuthenticated, requireWebAccess, async (req: any, res: any, next: any) => {
    const { getClientInvoices } = await import("./controllers/client.controller");
    return getClientInvoices(req, res, next);
  });

  // Global invoice approval/publishing routes (Admin only, Web-only)
  app.put("/api/invoices/:invoiceId/approve", isAuthenticated, requireWebAccess, isAdmin, async (req: any, res: any, next: any) => {
    const { approveInvoice } = await import("./controllers/invoice.controller");
    return approveInvoice(req, res, next);
  });

  app.put("/api/invoices/:invoiceId/reject", isAuthenticated, requireWebAccess, isAdmin, async (req: any, res: any, next: any) => {
    const { rejectInvoice } = await import("./controllers/invoice.controller");
    return rejectInvoice(req, res, next);
  });

  app.put("/api/invoices/:invoiceId/publish", isAuthenticated, requireWebAccess, isAdmin, async (req: any, res: any, next: any) => {
    const { publishInvoice } = await import("./controllers/invoice.controller");
    return publishInvoice(req, res, next);
  });

  app.put("/api/invoices/:invoiceId/unpublish", isAuthenticated, requireWebAccess, isAdmin, async (req: any, res: any, next: any) => {
    const { unpublishInvoice } = await import("./controllers/invoice.controller");
    return unpublishInvoice(req, res, next);
  });

  // Admin endpoint to get projects for a specific client (Web-only)
  app.get("/api/admin/client-projects/:clientId", isAuthenticated, requireWebAccess, isAdmin, async (req: any, res: any) => {
    try {
      const { storage } = await import("./storage");
      const clientId = req.params.clientId;

      if (!clientId) {
        return res.status(400).json({ message: "Client ID is required" });
      }

      console.log(`[Admin] Fetching projects for client: ${clientId}`);
      const projects = await storage.projects.getProjectsForUser(clientId);

      res.json(projects);
    } catch (error) {
      console.error(`Error fetching projects for client ${req.params.clientId}:`, error);
      res.status(500).json({ message: "Failed to fetch client projects" });
    }
  });

  // Get all project managers for assignment dropdowns (Web-only)
  app.get("/api/project-managers", isAuthenticated, requireWebAccess, isAdmin, async (req: any, res: any) => {
    try {
      const { storage } = await import("./storage");
      const projectManagers = await storage.users.getByRole("projectManager");
      res.json(projectManagers);
    } catch (error) {
      console.error("Error fetching project managers:", error);
      res.status(500).json({ message: "Failed to fetch project managers" });
    }
  });



  // --- Mount Project-Specific Routers ---
  // Apply common middleware like isAuthenticated and validateProjectId here

  // Project Manager Dashboard Routes (Web-only)
  const projectManagerRouter = await import("./routes/project-manager.routes");
  app.use("/api/project-manager", isAuthenticated, requireWebAccess, projectManagerRouter.default);

  // Project Administration Routes - Enhanced permissions for project managers (Web-only)
  const projectAdminRouter = await import("./routes/project-admin.routes");
  app.use(
    "/api/projects/:projectId/admin",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    projectAdminRouter.default
  );

  // Documents within a project (Web-only)
  app.use(
    "/api/projects/:projectId/documents",
    isAuthenticated,
    requireWebAccess,
    validateProjectId, // Ensure projectId is valid before proceeding
    projectDocumentRouter
  );

  // Invoices within a project (Web-only)
  app.use(
    "/api/projects/:projectId/invoices",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    invoiceRouter
  );

  // Messages within a project (Web-only)
  app.use(
    "/api/projects/:projectId/messages",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    messageRouter
  );

  // Progress Updates within a project (Web-only)
  app.use(
    "/api/projects/:projectId/updates",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    progressUpdateRouter
  );

  // Global progress updates endpoint (for AI Report Review Dashboard) (Web-only)
  app.get("/api/progress-updates", isAuthenticated, requireWebAccess, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { progressUpdates } = await import("@shared/schema");
      const { db } = await import("@server/db");
      const { desc, sql } = await import("drizzle-orm");

      // Fetch all AI-generated progress updates
      const updates = await db
        .select()
        .from(progressUpdates)
        .where(sql`${progressUpdates.generatedByAI} = true`)
        .orderBy(desc(progressUpdates.createdAt));

      res.json({ updates });
    } catch (error) {
      console.error("[API] Error fetching progress updates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch progress updates",
      });
    }
  });

  // Tasks within a project (Web-only)
  // Mount ONLY ONCE with all necessary middleware
  app.use(
    "/api/projects/:projectId/tasks",
    isAuthenticated,      // Check authentication first
    requireWebAccess,     // Check web access
    validateProjectId,    // Then validate the ID
    taskRouterModule      // Then pass to the specific task router
  );

  // Daily Logs within a project (Web-only)
  app.use(
    "/api/projects/:projectId/daily-logs",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    dailyLogRouter // Assuming dailyLogRouter is imported
  );

  // Punch List within a project (Web-only)
  app.use(
    "/api/projects/:projectId/punch-list",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    punchListRouter // Assuming punchListRouter is imported
  );

  // --- Mount other project-specific or admin routers ---
  // Milestones within a project (Web-only)
  app.use(
    "/api/projects/:projectId/milestones",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    milestoneRoutes
  );

  // Unified content API - fetch all content types for a project (Web-only)
  app.use(
    "/api/projects/:projectId/unified-content",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    unifiedContentRoutes
  );

  // =========================================================================
  // MOBILE-ACCESSIBLE ROUTES (Must be registered before broad "/api" middleware)
  // =========================================================================

  // Note: Admin Images routes already registered earlier (line ~109) to ensure proper middleware order

  // =========================================================================
  // WEB-ONLY ROUTES (Can use broad "/api" middleware)
  // =========================================================================

  // Task billing routes for complete-and-bill functionality (Web-only)
  // Note: If taskBillingRouter doesn't have isAuthenticated, add it
  app.use("/api", isAuthenticated, requireWebAccess, taskBillingRouter);

  // Billing validation routes (Web-only)
  app.use(
    "/api/projects/:projectId/billing-validation",
    isAuthenticated,
    requireWebAccess,
    validateProjectId,
    billingValidationRouter
  );

  // Example: Selections
  // app.use(
  //   "/api/projects/:projectId/selections",
  //   isAuthenticated,
  //   validateProjectId,
  //   selectionRouter // Assuming selectionRouter is imported
  // );

  // Example: Admin routes (ensure isAdmin middleware is used appropriately within adminRouter)
  // app.use("/api/admin", isAuthenticated, isAdmin, adminRouter);

  // Mount RAG system routes (Web-only)
  app.use("/api/rag", isAuthenticated, requireWebAccess, ragRouter);

  // Mount Quote system routes (Web-only for management)
  app.use("/api/quotes", isAuthenticated, requireWebAccess, quoteRouter);

  // Mount Quote Analytics routes (mixed auth - public tracking, admin analytics)
  // Note: Contains public endpoints, do not protect at router level
  app.use("/api", quoteAnalyticsRouter);

  // Mount Payment routes (mixed auth - public payment processing, admin invoice management)
  // Note: Contains public endpoints, do not protect at router level
  app.use("/api", paymentRoutes);

  // Mount Project Payment Summary routes (admin only, Web-only)
  app.use("/api/projects", isAuthenticated, requireWebAccess, projectPaymentRoutes);

  // Note: Storage/R2 routes already mounted earlier (line ~122) to ensure public proxy access

  // Mount Chat routes (mixed auth - admin authenticated, customer public tokens)
  // Note: Contains public endpoints, do not protect at router level
  app.use("/api/chat", chatRouter);

  // Mount AI Agent routes (authenticated users only, Web-only)
  app.use("/api/agent", isAuthenticated, requireWebAccess, agentRouter);

  // Mount Lead routes (authenticated users only)
  app.use("/api/leads", isAuthenticated, leadRouter);

  // Mount Interview routes (PM/Admin only - role check in router)
  app.use("/api/interview", interviewRouter);

  // Mount TTS routes (authenticated users only)
  app.use("/api/tts", ttsRouter);

  // Mount Webhook routes (no authentication - Stripe handles verification)
  app.use("/api/webhooks", webhookRoutes);

  // Mount Global Finance routes (admin only, Web-only)
  // Note: This uses broad "/api" prefix, so specific routes must be registered before this
  app.use("/api", requireWebAccess, globalFinanceRoutes);

  // Mount Client Portal routes (Web-only)
  app.use("/api/client", isAuthenticated, requireWebAccess, clientRouter);

  // Mount Google Drive Ingestion routes (admin only, Web-only)
  app.use("/api/drive-ingestion", isAuthenticated, requireWebAccess, driveIngestionRouter);

  // --- REMOVED: Old inline route definitions and local router variables ---
  // const taskRouter = Router(...) // REMOVED
  // const dailyLogRouter = Router(...) // REMOVED
  // const punchListRouter = Router(...) // REMOVED
  // taskRouter.get(...) // REMOVED
  // dailyLogRouter.get(...) // REMOVED
  // punchListRouter.get(...) // REMOVED
  // app.use("/api/projects/:projectId/tasks", ...) // REMOVED duplicate mount

  // No need to return the server instance from here anymore
  // const httpServer = createServer(app);
  // return httpServer;
}
