// server/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Router } from "express"; // Keep Router for potential future use or other routes defined here

// Import middleware
import { isAuthenticated, isAdmin } from "@server/middleware/auth.middleware";
import { validateProjectId } from "@server/middleware/validation.middleware";
// Import Schemas/Types if needed for other routes defined in this file
import { User } from "@shared/schema";

// --- Core Auth Setup ---
import { setupAuth } from "@server/auth";

// --- Import Feature Routers ---
import authRouter from "@server/routes/auth.routes";
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
import clientRouter from "./routes/client.routes"; // Client portal router
import billingValidationRouter from "./routes/billing-validation.routes"; // Billing validation router
import expensifyRouter from "./routes/expensify.routes"; // Expensify integration router

import { storageRoutes } from "./routes/storage-routes"; // Storage/R2 router
import chatRouter from "./routes/chat.routes"; // Stream Chat router
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

  // --- Mount Auth-specific routes (Password Reset, etc.) ---
  // Note: setupAuth likely already added /login, /logout, /api/user etc.
  // This router is for additional auth flows like password reset.
  app.use("/api", authRouter); // Assuming authRouter handles routes like /api/password-reset-request

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
  // Base path: /api/documents
  app.use("/api/documents", isAuthenticated, globalDocumentRouter);

  // --- Mount Global Admin Routes ---
  // Global invoice access for admins
  app.get("/api/admin/invoices", isAuthenticated, isAdmin, async (req: any, res: any, next: any) => {
    const { getAllInvoices } = await import("./controllers/invoice.controller");
    return getAllInvoices(req, res, next);
  });

  // Client invoice access - for both clients and admins
  app.get("/api/client/invoices", isAuthenticated, async (req: any, res: any, next: any) => {
    const { getClientInvoices } = await import("./controllers/client.controller");
    return getClientInvoices(req, res, next);
  });

  // Get all project managers for assignment dropdowns
  app.get("/api/project-managers", isAuthenticated, isAdmin, async (req: any, res: any) => {
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

  // Project Manager Dashboard Routes
  const projectManagerRouter = await import("./routes/project-manager.routes");
  app.use("/api/project-manager", projectManagerRouter.default);

  // Project Administration Routes - Enhanced permissions for project managers
  const projectAdminRouter = await import("./routes/project-admin.routes");
  app.use(
    "/api/projects/:projectId/admin",
    isAuthenticated,
    validateProjectId,
    projectAdminRouter.default
  );

  // Documents within a project
  app.use(
    "/api/projects/:projectId/documents",
    isAuthenticated,
    validateProjectId, // Ensure projectId is valid before proceeding
    projectDocumentRouter
  );

  // Invoices within a project
  app.use(
    "/api/projects/:projectId/invoices",
    isAuthenticated,
    validateProjectId,
    invoiceRouter
  );

  // Messages within a project
  app.use(
    "/api/projects/:projectId/messages",
    isAuthenticated,
    validateProjectId,
    messageRouter
  );

  // Progress Updates within a project
  app.use(
    "/api/projects/:projectId/updates",
    isAuthenticated,
    validateProjectId,
    progressUpdateRouter
  );

  // Tasks within a project
  // Mount ONLY ONCE with all necessary middleware
  app.use(
    "/api/projects/:projectId/tasks",
    isAuthenticated,      // Check authentication first
    validateProjectId,    // Then validate the ID
    taskRouterModule      // Then pass to the specific task router
  );

  // Daily Logs within a project
  app.use(
    "/api/projects/:projectId/daily-logs",
    isAuthenticated,
    validateProjectId,
    dailyLogRouter // Assuming dailyLogRouter is imported
  );

  // Punch List within a project
  app.use(
    "/api/projects/:projectId/punch-list",
    isAuthenticated,
    validateProjectId,
    punchListRouter // Assuming punchListRouter is imported
  );

  // --- Mount other project-specific or admin routers ---
  // Milestones within a project
  app.use(
    "/api/projects/:projectId/milestones",
    isAuthenticated,
    validateProjectId,
    milestoneRoutes
  );
  
  // Task billing routes for complete-and-bill functionality
  app.use(taskBillingRouter);

  // Billing validation routes
  app.use(
    "/api/projects/:projectId/billing-validation",
    isAuthenticated,
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

  // Mount RAG system routes
  app.use("/api/rag", ragRouter);

  // Mount Quote system routes
  app.use("/api/quotes", quoteRouter);

  // Mount Quote Analytics routes (mixed auth - public tracking, admin analytics)
  app.use("/api", quoteAnalyticsRouter);

  // Mount Payment routes (mixed auth - public payment processing, admin invoice management)
  app.use("/api", paymentRoutes);

  // Mount Project Payment Summary routes (admin only)
  app.use("/api/projects", isAuthenticated, projectPaymentRoutes);

  // Mount Storage/R2 routes with mixed authentication
  app.use("/api/storage", storageRoutes);

  // Mount Chat routes (mixed auth - admin authenticated, customer public tokens)
  app.use("/api/chat", chatRouter);

  // Mount Webhook routes (no authentication - Stripe handles verification)
  app.use("/api/webhooks", webhookRoutes);

  // Mount Global Finance routes (admin only)
  app.use("/api", globalFinanceRoutes);

  // Mount Client Portal routes
  app.use("/api/client", isAuthenticated, clientRouter);

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
