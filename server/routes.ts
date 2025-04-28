import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Router } from "express";
import { storage } from "@server/storage"; // Updated import
import { setupAuth } from "@server/auth"; // Updated import
import { uploadToR2 } from "@server/r2-upload"; // Updated import
// Import middleware
import { upload } from "@server/middleware/upload.middleware"; // Updated import
import { isAuthenticated, isAdmin } from "@server/middleware/auth.middleware"; // Updated import
import { checkProjectAccess } from "@server/middleware/permissions.middleware"; // Updated import
// Import Schemas/Types
import {
  insertProjectSchema,
  insertDocumentSchema,
  insertInvoiceSchema,
  insertMessageSchema,
  insertProgressUpdateSchema, // Keep if needed elsewhere
  insertMilestoneSchema,
  insertSelectionSchema,
  User,
  tasks as tasksTable,
  // ... other schema imports
  insertTaskSchema,
  insertTaskDependencySchema,
  insertDailyLogSchema,
  insertPunchListItemSchema
} from "@shared/schema";
import { z } from "zod";
import { isEmailServiceConfigured, sendMagicLinkEmail } from "@server/email"; // Updated import
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { ilike, or, eq, and } from "drizzle-orm";
import multer from 'multer';

// --- ADDED: Import new routers ---
import authRouter from "@server/routes/auth.routes"; // Updated import
import projectRouter from "@server/routes/project.routes"; // Updated import
import { projectDocumentRouter, globalDocumentRouter } from "@server/routes/document.routes"; // Updated import
import invoiceRouter from "@server/routes/invoice.routes"; // Updated import
import messageRouter from "@server/routes/message.routes"; // Updated import
import progressUpdateRouter from "@server/routes/progressUpdate.routes"; // Updated import
// --- END ADDED ---


const scryptAsync = promisify(scrypt);

// Middleware definitions are now in ./middleware/

// Define Routers for features (Tasks, Daily Logs, Punch List) - Keep definitions for now
const taskRouter = Router({ mergeParams: true });
const dailyLogRouter = Router({ mergeParams: true });
const punchListRouter = Router({ mergeParams: true });

// Define interfaces for request params
interface ParamsDictionary { [key: string]: string; }
interface ProjectParams extends ParamsDictionary { projectId: string; }
interface TaskParams extends ProjectParams { taskId: string; }
interface DailyLogParams extends ProjectParams { logId: string; }
interface PunchListItemParams extends ProjectParams { itemId: string; }

// =========================================================================
// Task Router Implementation (Still defined here)
// =========================================================================
taskRouter.get("/", async (req: Request<ProjectParams>, res) => { /* ... handler ... */ });
// ... (rest of taskRouter routes) ...
taskRouter.delete("/dependencies/:dependencyId", async (req: Request<{ projectId: string, dependencyId: string }>, res) => { /* ... handler ... */ });


// =========================================================================
// Daily Log Router Implementation (Still defined here)
// =========================================================================
dailyLogRouter.get("/", async (req: Request<ProjectParams>, res) => { /* ... handler ... */ });
// ... (rest of dailyLogRouter routes) ...
dailyLogRouter.delete("/:logId", async (req: Request<DailyLogParams>, res) => { /* ... handler ... */ });


// =========================================================================
// Punch List Router Implementation (Still defined here)
// =========================================================================
punchListRouter.get("/", async (req: Request<ProjectParams>, res) => { /* ... handler ... */ });
// ... (rest of punchListRouter routes) ...
punchListRouter.delete("/:itemId", async (req: Request<PunchListItemParams>, res) => { /* ... handler ... */ });


// =========================================================================
// Main Route Registration Function
// =========================================================================
export async function registerRoutes(app: Express): Promise<Server> {

  // --- Core Auth Routes ---
  setupAuth(app);

  // --- Mount Auth router (Password Reset) ---
  app.use("/api", authRouter);

  // --- Development-only routes ---
  if (process.env.NODE_ENV === 'development') {
    app.get("/api/dev/reset-tokens", async (req, res) => { /* ... handler ... */ });
    app.post("/api/dev/create-admin", async (req, res) => { /* ... handler ... */ });
  }

  // =========================================================================
  // Resource Routes Mounting / Definitions
  // =========================================================================

  // --- Mount Project Router ---
  app.use("/api/projects", projectRouter);

  // --- Mount Document Routers ---
  app.use("/api/documents", isAuthenticated, globalDocumentRouter);
  app.use("/api/projects/:projectId/documents", isAuthenticated, projectDocumentRouter);

  // --- Mount Invoice Router ---
  app.use("/api/projects/:projectId/invoices", isAuthenticated, invoiceRouter);

  // --- Mount Message Router ---
  app.use("/api/projects/:projectId/messages", isAuthenticated, messageRouter);

  // --- Mount Progress Update Router ---
  app.use("/api/projects/:projectId/updates", isAuthenticated, progressUpdateRouter);
  // --- END Mount Progress Update Router ---

  // --- REMOVED: Original Progress Update Route Definitions ---
  // app.get("/api/projects/:projectId/updates", isAuthenticated, async (req, res) => { /* ... */ });
  // app.post("/api/projects/:projectId/updates", isAuthenticated, async (req, res) => { /* ... */ });


  // --- Client-Project Association Routes (Keep definitions here for now) ---
  app.post("/api/client-projects", isAdmin, async (req, res) => { /* ... handler ... */ });
  // ... (rest of client-project routes) ...
  app.get("/api/projects/:projectId/available-clients", isAuthenticated, async (req, res) => { /* ... handler ... */ });

  // --- Milestone Routes (Keep definitions here for now) ---
  app.get("/api/projects/:projectId/milestones", isAuthenticated, async (req, res) => { /* ... handler ... */ });
  app.post("/api/projects/:projectId/milestones", isAuthenticated, async (req, res) => { /* ... handler ... */ });

  // --- Selection Routes (Keep definitions here for now) ---
  app.get("/api/projects/:projectId/selections", isAuthenticated, async (req, res) => { /* ... handler ... */ });
  app.post("/api/projects/:projectId/selections", isAuthenticated, async (req, res) => { /* ... handler ... */ });
  app.put("/api/projects/:projectId/selections/:id", isAuthenticated, async (req, res) => { /* ... handler ... */ });

  // --- Admin Routes (Keep definitions here for now) ---
  app.get("/api/admin/clients/search", isAdmin, async (req, res) => { /* ... handler ... */ });
  // ... (rest of admin routes) ...
  app.post("/api/admin/projects/:projectId/project-manager", isAdmin, async (req, res) => { /* ... handler ... */ });

  // --- Project Manager Routes (Keep definitions here for now) ---
  app.get("/api/project-manager/projects", isAuthenticated, async (req, res) => { /* ... handler ... */ });


  // --- Mount nested resource routers (Keep definitions here for now) ---
  app.use("/api/projects/:projectId/tasks", isAuthenticated, taskRouter);
  app.use("/api/projects/:projectId/daily-logs", isAuthenticated, dailyLogRouter);
  app.use("/api/projects/:projectId/punch-list", isAuthenticated, punchListRouter);

  const httpServer = createServer(app);
  return httpServer;
}