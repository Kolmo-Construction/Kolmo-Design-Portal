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
import { quoteRoutes } from "./routes/quote-routes"; // Quote management router
import { publicQuoteRoutes } from "./routes/public-quote-routes"; // Public quote access router
import { storageRoutes } from "./routes/storage-routes"; // Storage/R2 router
import { beforeAfterRoutes } from "./routes/before-after-routes"; // Before/after pairs management
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

  // --- Mount Project-Specific Routers ---
  // Apply common middleware like isAuthenticated and validateProjectId here

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
  // Example: Milestones
  // app.use(
  //   "/api/projects/:projectId/milestones",
  //   isAuthenticated,
  //   validateProjectId,
  //   milestoneRouter // Assuming milestoneRouter is imported
  // );

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

  // Mount public quote view routes (no authentication required) - MUST COME FIRST
  app.use("/api/quotes/view", publicQuoteRoutes);
  
  // Mount Quote Management routes (authenticated)
  app.use("/api/quotes", isAuthenticated, quoteRoutes);

  // Mount Storage/R2 routes with mixed authentication
  app.use("/api/storage", storageRoutes);
  
  // Mount Before/After Pairs management routes (authenticated)
  app.use("/api", beforeAfterRoutes);

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
