import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from 'multer'; // <-- Import multer
import { Router } from "express"; // <-- ADDED: Import Router
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { uploadToR2 } from "./r2-upload"; // <-- Import the updated upload function
import {
  insertProjectSchema,
  insertDocumentSchema,
  insertInvoiceSchema,
  insertMessageSchema,
  insertProgressUpdateSchema,
  insertMilestoneSchema,
  insertSelectionSchema,
  User, // Added User type import
  // --- ADDED: Import new schema items ---
  tasks as tasksTable,
  taskDependencies as taskDependenciesTable,
  dailyLogs as dailyLogsTable,
  dailyLogPhotos as dailyLogPhotosTable,
  punchListItems as punchListItemsTable,
  insertTaskSchema,
  insertDailyLogSchema,
  insertPunchListItemSchema
  // --- END ADDED ---
} from "@shared/schema";
import { z } from "zod";
import { isEmailServiceConfigured, sendMagicLinkEmail } from "./email";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { ilike, or, eq, and } from "drizzle-orm"; // <-- ADDED: eq, and

const scryptAsync = promisify(scrypt);

// --- Multer Configuration ---
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit (adjust as needed)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain',
  'application/zip', // Allow zip files
  // Add other allowed types as needed
];

const storageEngine = multer.memoryStorage(); // Store files in memory temporarily

const upload = multer({
  storage: storageEngine,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true); // Accept file
    } else {
      // Reject file with a specific error message
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  }
});
// --- End Multer Configuration ---


// Helper function to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Helper function to check if user is an admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user && req.user.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Admin access required" });
}

// Helper function to check project access based on user role
async function checkProjectAccess(req: Request, res: Response, projectId: number): Promise<boolean> {
   // Ensure user is authenticated before checking access
  if (!req.isAuthenticated() || !req.user) {
     res.status(401).json({ message: "Unauthorized" });
     return false;
  }
  const user = req.user!;

  // Admins can access any project
  if (user.role === "admin") {
    return true;
  }
  // Project managers can only access projects they're assigned to
  else if (user.role === "projectManager") {
    const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
    if (!hasAccess) {
      res.status(403).json({ message: "You don't have access to this project" });
      return false;
    }
  }
  // Clients can only access projects they're assigned to
  else if (user.role === "client") {
    const hasAccess = await storage.clientHasProjectAccess(user.id, projectId);
    if (!hasAccess) {
      res.status(403).json({ message: "You don't have access to this project" });
      return false;
    }
  }
  // Handle unexpected roles if necessary
  else {
      res.status(403).json({ message: "Forbidden" });
      return false;
  }

  return true;
}

// --- ADDED: Define Routers for new features ---
// mergeParams allows access to :projectId from the parent route (app.use)
const taskRouter = Router({ mergeParams: true });
const dailyLogRouter = Router({ mergeParams: true });
const punchListRouter = Router({ mergeParams: true });

// Define interfaces for request params
// Define a type for params dictionary
interface ParamsDictionary {
  [key: string]: string;
}

interface ProjectParams extends ParamsDictionary {
  projectId: string;
}

interface TaskParams extends ProjectParams {
  taskId: string;
}

interface DailyLogParams extends ProjectParams {
  logId: string;
}

interface PunchListItemParams extends ProjectParams {
  itemId: string;
}

// Task Router Implementation
// GET all tasks for a project
taskRouter.get("/", async (req: Request<ProjectParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Check if user has access to this project
    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    const tasks = await storage.getProjectTasks(projectId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching project tasks:", error);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

// GET a single task
taskRouter.get("/:taskId", async (req: Request<TaskParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(projectId) || isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid project ID or task ID" });
    }

    // Check if user has access to this project
    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    // Verify the task belongs to the specified project
    if (task.projectId !== projectId) {
      return res.status(404).json({ message: "Task not found in this project" });
    }
    
    res.json(task);
  } catch (error) {
    console.error("Error fetching task details:", error);
    res.status(500).json({ message: "Failed to fetch task details" });
  }
});

// POST create a new task
taskRouter.post("/", async (req: Request<ProjectParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Check if user has access to this project (only admins and project managers can create tasks)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can create tasks" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    // Validate the task data
    const taskData = insertTaskSchema.parse(req.body);

    // Ensure the task is created for the specified project
    const newTask = await storage.createTask({
      ...taskData,
      projectId // Override projectId to ensure it matches the URL param
    });

    res.status(201).json(newTask);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid task data", errors: error.errors });
    }
    console.error("Error creating task:", error);
    res.status(500).json({ message: "Failed to create task" });
  }
});

// PUT update a task
taskRouter.put("/:taskId", async (req: Request<TaskParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(projectId) || isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid project ID or task ID" });
    }

    // Check if user has access (only admins and project managers can update tasks)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can update tasks" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    // First, check if the task exists and belongs to this project
    const existingTask = await storage.getTask(taskId);
    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    if (existingTask.projectId !== projectId) {
      return res.status(404).json({ message: "Task not found in this project" });
    }

    // Validate update data
    const updateData = insertTaskSchema.partial().parse(req.body);

    // Update the task
    const updatedTask = await storage.updateTask(taskId, {
      ...updateData,
      projectId // Ensure projectId remains unchanged
    });

    if (!updatedTask) {
      return res.status(404).json({ message: "Task not found or failed to update" });
    }

    res.json(updatedTask);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid task data", errors: error.errors });
    }
    console.error("Error updating task:", error);
    res.status(500).json({ message: "Failed to update task" });
  }
});

// DELETE a task
taskRouter.delete("/:taskId", async (req: Request<TaskParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(projectId) || isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid project ID or task ID" });
    }

    // Check if user has access (only admins and project managers can delete tasks)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can delete tasks" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    // Check if the task exists and belongs to this project
    const existingTask = await storage.getTask(taskId);
    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    if (existingTask.projectId !== projectId) {
      return res.status(404).json({ message: "Task not found in this project" });
    }

    // Delete the task
    await storage.deleteTask(taskId);
    
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ message: "Failed to delete task" });
  }
});

// Daily Log Router Implementation
// GET all daily logs for a project
dailyLogRouter.get("/", async (req: Request<ProjectParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Check if user has access to this project
    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    const dailyLogs = await storage.getProjectDailyLogs(projectId);
    res.json(dailyLogs);
  } catch (error) {
    console.error("Error fetching project daily logs:", error);
    res.status(500).json({ message: "Failed to fetch daily logs" });
  }
});

// GET a single daily log
dailyLogRouter.get("/:logId", async (req: Request<DailyLogParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const logId = parseInt(req.params.logId);
    
    if (isNaN(projectId) || isNaN(logId)) {
      return res.status(400).json({ message: "Invalid project ID or log ID" });
    }

    // Check if user has access to this project
    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    const dailyLog = await storage.getDailyLog(logId);
    
    if (!dailyLog) {
      return res.status(404).json({ message: "Daily log not found" });
    }
    
    // Verify the log belongs to the specified project
    if (dailyLog.projectId !== projectId) {
      return res.status(404).json({ message: "Daily log not found in this project" });
    }
    
    res.json(dailyLog);
  } catch (error) {
    console.error("Error fetching daily log details:", error);
    res.status(500).json({ message: "Failed to fetch daily log details" });
  }
});

// POST create a new daily log
dailyLogRouter.post("/", upload.array('photos', 5), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Check if user has access to this project (only admins and project managers can create logs)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can create daily logs" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    // The body will be form data due to file uploads, so we need to parse it differently
    const logData = insertDailyLogSchema.parse({
      ...req.body,
      projectId, // Ensure projectId matches URL param
      createdById: user.id, // Set the creator to the current user
      logDate: req.body.logDate ? new Date(req.body.logDate) : new Date() // Parse date
    });

    // Create the daily log
    const newDailyLog = await storage.createDailyLog(logData);

    // Handle photo uploads if any
    const uploadedPhotos = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          // Upload the file to R2 or your storage service
          const photoUrl = await uploadToR2(
            projectId,
            file.buffer,
            file.originalname,
            file.mimetype
          );

          // Create a record for the photo
          const photo = await storage.addDailyLogPhoto({
            dailyLogId: newDailyLog.id,
            photoUrl,
            caption: file.originalname, // Use filename as caption or get from form
            uploadedById: user.id
          });

          uploadedPhotos.push(photo);
        } catch (uploadError) {
          console.error("Error uploading photo:", uploadError);
          // Continue with other photos even if one fails
        }
      }
    }

    res.status(201).json({
      dailyLog: newDailyLog,
      photos: uploadedPhotos
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid daily log data", errors: error.errors });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: "File upload error", error: error.message });
    }
    console.error("Error creating daily log:", error);
    res.status(500).json({ message: "Failed to create daily log" });
  }
});

// PUT update a daily log
dailyLogRouter.put("/:logId", async (req: Request<DailyLogParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const logId = parseInt(req.params.logId);
    
    if (isNaN(projectId) || isNaN(logId)) {
      return res.status(400).json({ message: "Invalid project ID or log ID" });
    }

    // Check if user has access (only admins and project managers can update logs)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can update daily logs" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    // Check if the log exists and belongs to this project
    const existingLog = await storage.getDailyLog(logId);
    if (!existingLog) {
      return res.status(404).json({ message: "Daily log not found" });
    }
    
    if (existingLog.projectId !== projectId) {
      return res.status(404).json({ message: "Daily log not found in this project" });
    }

    // Validate update data
    const updateData = insertDailyLogSchema.partial().parse({
      ...req.body,
      logDate: req.body.logDate ? new Date(req.body.logDate) : undefined
    });

    // Update the log
    const updatedLog = await storage.updateDailyLog(logId, {
      ...updateData,
      projectId // Ensure projectId remains unchanged
    });

    if (!updatedLog) {
      return res.status(404).json({ message: "Daily log not found or failed to update" });
    }

    res.json(updatedLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid daily log data", errors: error.errors });
    }
    console.error("Error updating daily log:", error);
    res.status(500).json({ message: "Failed to update daily log" });
  }
});

// DELETE a daily log
dailyLogRouter.delete("/:logId", async (req: Request<DailyLogParams>, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const logId = parseInt(req.params.logId);
    
    if (isNaN(projectId) || isNaN(logId)) {
      return res.status(400).json({ message: "Invalid project ID or log ID" });
    }

    // Check if user has access (only admins and project managers can delete logs)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can delete daily logs" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    // Check if the log exists and belongs to this project
    const existingLog = await storage.getDailyLog(logId);
    if (!existingLog) {
      return res.status(404).json({ message: "Daily log not found" });
    }
    
    if (existingLog.projectId !== projectId) {
      return res.status(404).json({ message: "Daily log not found in this project" });
    }

    // Delete the log (photos should be deleted via CASCADE constraint)
    await storage.deleteDailyLog(logId);
    
    res.status(200).json({ message: "Daily log deleted successfully" });
  } catch (error) {
    console.error("Error deleting daily log:", error);
    res.status(500).json({ message: "Failed to delete daily log" });
  }
});

// Punch List Router Implementation
// GET all punch list items for a project
punchListRouter.get("/", async (req: Request<ProjectParams>, res) => {
  try {
    // Add explicit type assertions for TypeScript
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Check if user has access to this project
    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    const punchListItems = await storage.getProjectPunchListItems(projectId);
    res.json(punchListItems);
  } catch (error) {
    console.error("Error fetching project punch list items:", error);
    res.status(500).json({ message: "Failed to fetch punch list items" });
  }
});

// GET a single punch list item
punchListRouter.get("/:itemId", async (req: Request<PunchListItemParams>, res) => {
  try {
    // Add explicit type assertions for TypeScript
    const projectId = parseInt(req.params.projectId as string);
    const itemId = parseInt(req.params.itemId as string);
    
    if (isNaN(projectId) || isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid project ID or item ID" });
    }

    // Check if user has access to this project
    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    const item = await storage.getPunchListItem(itemId);
    
    if (!item) {
      return res.status(404).json({ message: "Punch list item not found" });
    }
    
    // Verify the item belongs to the specified project
    if (item.projectId !== projectId) {
      return res.status(404).json({ message: "Punch list item not found in this project" });
    }
    
    res.json(item);
  } catch (error) {
    console.error("Error fetching punch list item details:", error);
    res.status(500).json({ message: "Failed to fetch punch list item details" });
  }
});

// POST create a new punch list item
punchListRouter.post("/", upload.single('photo'), async (req: Request<ProjectParams>, res) => {
  try {
    // Add explicit type assertions for TypeScript
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Check if user has access (only admins and project managers can create punch list items)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can create punch list items" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    let photoUrl = null;
    // Handle photo upload if present
    if (req.file) {
      try {
        photoUrl = await uploadToR2(
          projectId,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
      } catch (uploadError) {
        console.error("Error uploading photo:", uploadError);
        // Continue without the photo
      }
    }

    // Validate item data
    const itemData = insertPunchListItemSchema.parse({
      ...req.body,
      projectId, // Ensure projectId matches URL param
      createdById: user.id, // Set the creator to the current user
      photoUrl, // Add the photo URL if uploaded
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined
    });

    // Create the punch list item
    const newItem = await storage.createPunchListItem(itemData);

    res.status(201).json(newItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid punch list item data", errors: error.errors });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: "File upload error", error: error.message });
    }
    console.error("Error creating punch list item:", error);
    res.status(500).json({ message: "Failed to create punch list item" });
  }
});

// PUT update a punch list item
punchListRouter.put("/:itemId", upload.single('photo'), async (req: Request<PunchListItemParams>, res) => {
  try {
    // Add explicit type assertions for TypeScript
    const projectId = parseInt(req.params.projectId as string);
    const itemId = parseInt(req.params.itemId as string);
    
    if (isNaN(projectId) || isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid project ID or item ID" });
    }

    // Check if user has access (only admins and project managers can update punch list items)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can update punch list items" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    // Check if the item exists and belongs to this project
    const existingItem = await storage.getPunchListItem(itemId);
    if (!existingItem) {
      return res.status(404).json({ message: "Punch list item not found" });
    }
    
    if (existingItem.projectId !== projectId) {
      return res.status(404).json({ message: "Punch list item not found in this project" });
    }

    let photoUrl = existingItem.photoUrl; // Default to existing photo URL
    // Handle photo upload if present
    if (req.file) {
      try {
        photoUrl = await uploadToR2(
          projectId,
          req.file.buffer,
          req.file.originalname, 
          req.file.mimetype
        );
      } catch (uploadError) {
        console.error("Error uploading photo:", uploadError);
        // Continue with existing photo
      }
    }

    // Validate update data
    const updateData = insertPunchListItemSchema.partial().parse({
      ...req.body,
      photoUrl, // Include new photo URL if uploaded
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      resolvedAt: req.body.status === 'resolved' ? new Date() : existingItem.resolvedAt
    });

    // Update the item
    const updatedItem = await storage.updatePunchListItem(itemId, {
      ...updateData,
      projectId // Ensure projectId remains unchanged
    });

    if (!updatedItem) {
      return res.status(404).json({ message: "Punch list item not found or failed to update" });
    }

    res.json(updatedItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid punch list item data", errors: error.errors });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: "File upload error", error: error.message });
    }
    console.error("Error updating punch list item:", error);
    res.status(500).json({ message: "Failed to update punch list item" });
  }
});

// DELETE a punch list item
punchListRouter.delete("/:itemId", async (req: Request<PunchListItemParams>, res) => {
  try {
    // Add explicit type assertions for TypeScript
    const projectId = parseInt(req.params.projectId as string);
    const itemId = parseInt(req.params.itemId as string);
    
    if (isNaN(projectId) || isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid project ID or item ID" });
    }

    // Check if user has access (only admins and project managers can delete punch list items)
    const user = req.user as User;
    if (!user || (user.role !== "admin" && user.role !== "projectManager")) {
      return res.status(403).json({ message: "Only project managers and admins can delete punch list items" });
    }

    if (!(await checkProjectAccess(req, res, projectId))) {
      return; // checkProjectAccess handles response
    }

    // Check if the item exists and belongs to this project
    const existingItem = await storage.getPunchListItem(itemId);
    if (!existingItem) {
      return res.status(404).json({ message: "Punch list item not found" });
    }
    
    if (existingItem.projectId !== projectId) {
      return res.status(404).json({ message: "Punch list item not found in this project" });
    }

    // Delete the item
    await storage.deletePunchListItem(itemId);
    
    res.status(200).json({ message: "Punch list item deleted successfully" });
  } catch (error) {
    console.error("Error deleting punch list item:", error);
    res.status(500).json({ message: "Failed to delete punch list item" });
  }
});
// --- END ADDED ---


export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Password reset endpoints
  // 1. Request a password reset link
  app.post("/api/password-reset-request", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);

      // If user exists, send reset email
      if (user) {
        // Generate token and expiry
        const token = randomBytes(32).toString('hex');
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24); // Token valid for 24 hours

        // Save token to user record
        await storage.updateUserMagicLinkToken(user.id, token, expiry);

        // Send reset email with magic link
        if (isEmailServiceConfigured()) {
          await sendMagicLinkEmail({
            email: user.email,
            firstName: user.firstName,
            token,
            resetPassword: true
          });
        } else {
          console.log(`[DEV] Password reset link: /reset-password/${token}`);
        }
      }

      // Always return success for security, even if user doesn't exist
      res.status(200).json({
        message: "If an account exists with that email, a password reset link has been sent."
      });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      // Still return success for security
      res.status(200).json({
        message: "If an account exists with that email, a password reset link has been sent."
      });
    }
  });

  // 2. Verify a password reset token
  app.get("/api/verify-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // Find user with this token
      const user = await storage.getUserByMagicLinkToken(token);

      // Check if user exists and token is not expired
      if (!user || !user.magicLinkExpiry || new Date(user.magicLinkExpiry) < new Date()) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      // Token is valid
      res.status(200).json({
        message: "Token is valid",
        userId: user.id
      });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ message: "Failed to verify token" });
    }
  });

  // 3. Reset password with token
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      // Find user with this token
      const user = await storage.getUserByMagicLinkToken(token);

      // Check if user exists and token is not expired
      if (!user || !user.magicLinkExpiry || new Date(user.magicLinkExpiry) < new Date()) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      // Hash the new password
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

      // Update user's password and clear the token
      await storage.updateUser(user.id, {
        password: hashedPassword
      });

      // Clear the magic link token
      await storage.updateUserMagicLinkToken(user.id, null, null);

      res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Development-only routes
  if (process.env.NODE_ENV === 'development') {
    // Get all password reset tokens for testing (DEVELOPMENT ONLY)
    app.get("/api/dev/reset-tokens", async (req, res) => {
      try {
        const users = await storage.getAllUsers();
        const resetTokens = users
          .filter(user => user.magicLinkToken && user.magicLinkExpiry && new Date(user.magicLinkExpiry) > new Date())
          .map(user => ({
            userId: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            tokenExpiry: user.magicLinkExpiry,
            resetLink: `/reset-password/${user.magicLinkToken}`
          }));

        res.json(resetTokens);
      } catch (error) {
        console.error("Error fetching reset tokens:", error);
        res.status(500).json({ message: "Error fetching reset tokens" });
      }
    });

    // Route to create an admin user
    app.post("/api/dev/create-admin", async (req, res) => {
      try {
        // Hash password
        const crypto = await import('crypto');
        const scrypt = (await import('util')).promisify(crypto.scrypt);

        // Generate salt and hash password
        const salt = crypto.randomBytes(16).toString("hex");
        const buf = (await scrypt("admin123", salt, 64)) as Buffer;
        const hashedPassword = `${buf.toString("hex")}.${salt}`;

        // Check if admin user already exists
        const existingAdmin = await storage.getUserByUsername("admin");

        if (existingAdmin) {
          return res.status(200).json({
            message: "Admin user already exists",
            user: {
              id: existingAdmin.id,
              username: existingAdmin.username,
              email: existingAdmin.email,
              role: existingAdmin.role
            }
          });
        }

        // Create admin user
        const adminUser = await storage.createUser({
          username: "admin",
          password: hashedPassword,
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "User",
          role: "admin",
          magicLinkToken: null,
          magicLinkExpiry: null,
          isActivated: true
        });

        // Return success response without sensitive data
        res.status(201).json({
          message: "Admin user created successfully",
          user: {
            id: adminUser.id,
            username: adminUser.username,
            email: adminUser.email,
            role: adminUser.role
          }
        });
      } catch (error) {
        console.error("Error creating admin user:", error);
        res.status(500).json({ message: "Error creating admin user" });
      }
    });
  }

  // Project routes
  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      let projects;

      if (user.role === "admin") {
        // Admins can see all projects
        projects = await storage.getAllProjects();
      } else if (user.role === "projectManager") {
        // Project managers can only see projects they're assigned to
        projects = await storage.getProjectManagerProjects(user.id);
      } else {
        // Clients can only see their assigned projects
        projects = await storage.getClientProjects(user.id);
      }

      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const user = req.user!;
      // Check permissions based on role (using checkProjectAccess helper)
      if (!(await checkProjectAccess(req, res, projectId))) {
         return; // checkProjectAccess handles the response
      }

      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project details" });
    }
  });

  app.post("/api/projects", isAdmin, async (req, res) => {
    try {
      console.log("Received project data:", req.body);
      // The schema now includes optional clientIds
      const projectDataWithClients = insertProjectSchema.parse(req.body);
      console.log("Validated project data:", projectDataWithClients);

      // Separate clientIds from project data for insertion
      const { clientIds, ...projectData } = projectDataWithClients;

      // Create the project first
      const newProject = await storage.createProject(projectData);

      // If clientIds are provided and the project was created, assign clients
      if (clientIds && clientIds.length > 0 && newProject) {
        try {
          for (const clientId of clientIds) {
            // Check if the user is actually a client before assigning
            const clientUser = await storage.getUser(clientId);
            if (clientUser && clientUser.role === 'client') {
               await storage.assignClientToProject(clientId, newProject.id);
            } else {
               console.warn(`Attempted to assign non-client user ID ${clientId} to project ${newProject.id}`);
            }
          }
          console.log(`Assigned ${clientIds.length} clients to project ${newProject.id}`);
        } catch (assignError) {
          console.error(`Error assigning clients to project ${newProject.id}:`, assignError);
          // Decide if you want to return an error or just warn and continue
        }
      }

      res.status(201).json(newProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", isAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      console.log("Received edit project data:", req.body);
      // Assuming clientIds might be passed for updating associations (handle separately if needed)
      const { clientIds, ...projectData } = insertProjectSchema.partial().parse(req.body); // Use partial for updates
      console.log("Validated edit project data:", projectData);

      const updatedProject = await storage.updateProject(projectId, projectData);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      // TODO: Handle client association updates if clientIds are passed

      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Edit validation error:", error.errors);
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Client-project association routes (admin only)
  app.post("/api/client-projects", isAdmin, async (req, res) => {
    try {
      const { clientId, projectId } = req.body;

      if (!clientId || !projectId) {
        return res.status(400).json({ message: "Client ID and Project ID are required" });
      }

      const clientProject = await storage.assignClientToProject(clientId, projectId);
      res.status(201).json(clientProject);
    } catch (error) {
      console.error("Error assigning client to project:", error);
      res.status(500).json({ message: "Failed to assign client to project" });
    }
  });

  // Client-project association routes (for project managers)
  app.post("/api/projects/:projectId/clients/:clientId", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const clientId = parseInt(req.params.clientId);
      const user = req.user!;

      if (isNaN(projectId) || isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid project or client ID" });
      }

      if (user.role !== "projectManager" && user.role !== "admin") {
        return res.status(403).json({ message: "Only project managers or admins can assign clients" });
      }

      // Check PM has access to the project they are assigning to
      if (user.role === "projectManager") {
          if (!(await checkProjectAccess(req, res, projectId))) {
              return; // Response handled by checkProjectAccess
          }
      }

      const client = await storage.getUser(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (client.role !== "client") {
        return res.status(400).json({ message: "User is not a client" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const clientProject = await storage.assignClientToProject(clientId, projectId);

      res.status(201).json({
        message: "Client assigned to project successfully",
        clientProject
      });
    } catch (error) {
      console.error("Error assigning client to project:", error);
      res.status(500).json({ message: "Failed to assign client to project" });
    }
  });

  // --- Document routes ---
  app.get("/api/projects/:projectId/documents", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check project access based on user role
      if (!(await checkProjectAccess(req, res, projectId))) {
        return; // Response already sent by checkProjectAccess
      }

      const documents = await storage.getProjectDocuments(projectId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // --- Document Upload Route ---
  // Applies Multer middleware *only* to this route
  app.post(
    "/api/projects/:projectId/documents",
    isAuthenticated,
    (req, res, next) => {
        // Apply multer middleware specifically to this route
        upload.single('documentFile')(req, res, (err) => {
            if (err) {
                // Handle Multer errors (like file size limit or invalid type)
                if (err instanceof multer.MulterError) {
                    console.warn(`Multer error during upload: ${err.code} - ${err.message}`);
                    let friendlyMessage = "Failed to upload file.";
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        friendlyMessage = `File exceeds the size limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`;
                    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                        friendlyMessage = err.message; // Use the message from the fileFilter
                    }
                    return res.status(400).json({ message: friendlyMessage, code: err.code });
                }
                // Handle other potential errors during upload middleware processing
                console.error("Error during upload middleware:", err);
                return res.status(500).json({ message: "An unexpected error occurred during file upload." });
            }
            // If no error, proceed to the route handler logic
            next();
        });
    },
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        // Check if file was actually uploaded by multer
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded." });
        }

        const user = req.user!;

        // Check if user has permission to upload documents for this project
        // (Allow Admin/PM, deny Client)
        if (user.role !== 'admin' && user.role !== 'projectManager') {
            if (user.role === 'client') {
                return res.status(403).json({ message: "Clients cannot upload documents" });
            } else {
                // If somehow another role exists, check access generically
                 if (!(await checkProjectAccess(req, res, projectId))) {
                    return; // Response handled by checkProjectAccess
                 }
            }
        } else if (user.role === 'projectManager') {
             // Double check PM access specifically if needed (already done by checkProjectAccess)
             if (!(await checkProjectAccess(req, res, projectId))) {
                 return;
             }
        }


        // --- Upload to R2 ---
        const fileBuffer = req.file.buffer;
        const originalFilename = req.file.originalname;
        const mimeType = req.file.mimetype;
        const fileSize = req.file.size;

        // Call the updated upload function
        const fileUrl = await uploadToR2(
          projectId,
          fileBuffer,
          originalFilename,
          mimeType
        );

        // --- Save metadata to database ---
        // Validate the rest of the form data from req.body
        const documentMetadata = insertDocumentSchema.parse({
          projectId,
          name: req.body.name || originalFilename, // Use original filename if name not provided
          description: req.body.description || "",
          fileUrl: fileUrl, // Use the URL returned from R2
          fileType: mimeType,
          fileSize: fileSize,
          category: req.body.category || "uncategorized", // Default category
          uploadedById: user.id,
        });

        const newDocument = await storage.createDocument(documentMetadata);

        res.status(201).json(newDocument);

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid document metadata", errors: error.errors });
        }
        // Handle errors from uploadToR2 or storage.createDocument
        console.error("Error processing document upload:", error);
        if (error instanceof Error && (error.message.includes("R2") || error.message.includes("storage"))) {
             res.status(500).json({ message: error.message });
        } else {
             res.status(500).json({ message: "Failed to process document upload." });
        }
      }
    }
  );
  // --- END Document Upload Route ---

  // Get all documents (for document center)
  app.get("/api/documents", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      let documents = [];

      // Parse date filters from query params if provided
      const filters: { startDate?: Date; endDate?: Date } = {};
      const { startDate, endDate } = req.query;

      if (startDate && typeof startDate === 'string') {
        const parsedDate = new Date(startDate);
        if (!isNaN(parsedDate.getTime())) {
          filters.startDate = parsedDate;
        }
      }

      if (endDate && typeof endDate === 'string') {
         const parsedDate = new Date(endDate);
         if (!isNaN(parsedDate.getTime())) {
            // Set to end of day for inclusive range
            parsedDate.setHours(23, 59, 59, 999);
            filters.endDate = parsedDate;
         }
      }


      if (user.role === "admin") {
        // Admins can see all documents
        documents = await storage.getAllDocuments(filters);
      } else if (user.role === "projectManager") {
        // Project managers can only see documents from projects they're assigned to
        const pmProjects = await storage.getProjectManagerProjects(user.id);

        if (pmProjects.length === 0) {
          return res.json([]);
        }

        // Fetch documents for each project the project manager has access to
        const projectIds = pmProjects.map(p => p.id);
        documents = await storage.getDocumentsForMultipleProjects(projectIds, filters);

      } else {
        // Clients can only see documents from projects they have access to
        const clientProjects = await storage.getClientProjects(user.id);

        if (clientProjects.length === 0) {
          return res.json([]);
        }

        // Fetch documents for each project the client has access to
        const projectIds = clientProjects.map(p => p.id);
        documents = await storage.getDocumentsForMultipleProjects(projectIds, filters);
      }

      res.json(documents);
    } catch (error) {
      console.error("Error fetching all documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });


  // Financial routes
  app.get("/api/projects/:projectId/invoices", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!(await checkProjectAccess(req, res, projectId))) {
        return;
      }

      const invoices = await storage.getProjectInvoices(projectId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/projects/:projectId/invoices", isAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const invoiceData = insertInvoiceSchema.parse({
        ...req.body,
        projectId
      });

      const newInvoice = await storage.createInvoice(invoiceData);
      res.status(201).json(newInvoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Message routes
  app.get("/api/projects/:projectId/messages", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!(await checkProjectAccess(req, res, projectId))) {
        return;
      }

      const messages = await storage.getProjectMessages(projectId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/projects/:projectId/messages", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!(await checkProjectAccess(req, res, projectId))) {
        return;
      }

      const messageData = insertMessageSchema.parse({
        ...req.body,
        projectId,
        senderId: req.user!.id
      });

      const newMessage = await storage.createMessage(messageData);
      res.status(201).json(newMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Progress update routes
  app.get("/api/projects/:projectId/updates", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!(await checkProjectAccess(req, res, projectId))) {
        return;
      }

      const updates = await storage.getProjectUpdates(projectId);
      res.json(updates);
    } catch (error) {
      console.error("Error fetching updates:", error);
      res.status(500).json({ message: "Failed to fetch updates" });
    }
  });

  app.post("/api/projects/:projectId/updates", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const user = req.user!;

      // Allow only Admin/PM to create updates
      if (user.role !== 'admin' && user.role !== 'projectManager') {
          return res.status(403).json({ message: "Clients cannot create progress updates" });
      } else {
          // Ensure PM has access to this specific project
          if (!(await checkProjectAccess(req, res, projectId))) {
             return;
          }
      }


      const updateData = insertProgressUpdateSchema.parse({
        ...req.body,
        projectId,
        createdById: user.id
      });

      const newUpdate = await storage.createProgressUpdate(updateData);
      res.status(201).json(newUpdate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      console.error("Error creating update:", error);
      res.status(500).json({ message: "Failed to create update" });
    }
  });

  // Milestone routes
  app.get("/api/projects/:projectId/milestones", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!(await checkProjectAccess(req, res, projectId))) {
        return;
      }

      const milestones = await storage.getProjectMilestones(projectId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.post("/api/projects/:projectId/milestones", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const user = req.user!;

      // Allow only Admin/PM to create milestones
      if (user.role !== 'admin' && user.role !== 'projectManager') {
          return res.status(403).json({ message: "Clients cannot create milestones" });
      } else {
           if (!(await checkProjectAccess(req, res, projectId))) {
              return;
           }
      }

      const milestoneData = insertMilestoneSchema.parse({
        ...req.body,
        projectId
      });

      const newMilestone = await storage.createMilestone(milestoneData);
      res.status(201).json(newMilestone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid milestone data", errors: error.errors });
      }
      console.error("Error creating milestone:", error);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  // Selection routes
  app.get("/api/projects/:projectId/selections", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!(await checkProjectAccess(req, res, projectId))) {
        return;
      }

      const selections = await storage.getProjectSelections(projectId);
      res.json(selections);
    } catch (error) {
      console.error("Error fetching selections:", error);
      res.status(500).json({ message: "Failed to fetch selections" });
    }
  });

  app.post("/api/projects/:projectId/selections", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const user = req.user!;

      // Allow only Admin/PM to create selections
      if (user.role !== 'admin' && user.role !== 'projectManager') {
          return res.status(403).json({ message: "Clients cannot create selections" });
      } else {
           if (!(await checkProjectAccess(req, res, projectId))) {
              return;
           }
      }

      const selectionData = insertSelectionSchema.parse({
        ...req.body,
        projectId
      });

      const newSelection = await storage.createSelection(selectionData);
      res.status(201).json(newSelection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid selection data", errors: error.errors });
      }
      console.error("Error creating selection:", error);
      res.status(500).json({ message: "Failed to create selection" });
    }
  });

  app.put("/api/projects/:projectId/selections/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const selectionId = parseInt(req.params.id);

      if (isNaN(projectId) || isNaN(selectionId)) {
        return res.status(400).json({ message: "Invalid project or selection ID" });
      }

      if (!(await checkProjectAccess(req, res, projectId))) {
        return;
      }

      const { selectedOption } = req.body;
      if (!selectedOption) {
        return res.status(400).json({ message: "Selected option is required" });
      }

      const updatedSelection = await storage.updateSelectionChoice(selectionId, selectedOption);
      if (!updatedSelection) {
        return res.status(404).json({ message: "Selection not found" });
      }

      res.json(updatedSelection);
    } catch (error) {
      console.error("Error updating selection:", error);
      res.status(500).json({ message: "Failed to update selection" });
    }
  });

  // Client Search Route
  app.get("/api/admin/clients/search", isAdmin, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.json([]);
      }
      const clients = await storage.searchClients(query);
      const sanitizedClients = clients.map(user => {
         const { password, magicLinkToken, magicLinkExpiry, ...clientData } = user;
         return clientData;
      });
      res.json(sanitizedClients);
    } catch (error) {
      console.error("Error searching clients:", error);
      res.status(500).json({ message: "Failed to search clients" });
    }
  });

  // User management routes (admin only)
  app.get("/api/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Sanitize users before sending
      const sanitizedUsers = users.map(user => {
         const { password, magicLinkToken, magicLinkExpiry, ...userData } = user;
         return userData;
      });
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get all project managers (admin only)
  app.get("/api/project-managers", isAdmin, async (req, res) => {
    try {
      const projectManagers = await storage.getAllProjectManagers();
      // Sanitize users before sending
       const sanitizedPMs = projectManagers.map(user => {
          const { password, magicLinkToken, magicLinkExpiry, ...pmData } = user;
          return pmData;
       });
      res.json(sanitizedPMs);
    } catch (error) {
      console.error("Error fetching project managers:", error);
      res.status(500).json({ message: "Failed to fetch project managers" });
    }
  });

  // Reset user password - admin only
  app.post("/api/admin/users/:userId/reset-password", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { newPassword } = req.body;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(newPassword, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

      const user = await storage.updateUser(userId, {
        password: hashedPassword
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        success: true,
        message: "Password reset successful"
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Delete user - admin only
  app.delete("/api/admin/users/:userId", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (req.user && req.user.id === userId) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.deleteUser(userId);

      res.json({
        success: true,
        message: "User deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Check email service configuration status - admin only
  app.get("/api/admin/email-config", isAdmin, (req, res) => {
    res.json({ configured: isEmailServiceConfigured() });
  });

  // Project manager specific routes
  app.get("/api/project-manager/projects", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;

      if (user.role !== "projectManager" && user.role !== "admin") {
        return res.status(403).json({ message: "Only project managers or admins can access this endpoint" });
      }

      let projects;
      if (user.role === "admin") {
        projects = await storage.getAllProjects();
      } else {
        projects = await storage.getProjectManagerProjects(user.id);
      }

      res.json(projects);
    } catch (error) {
      console.error("Error fetching project manager projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get available clients to assign to a project (for project managers)
  app.get("/api/projects/:projectId/available-clients", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = req.user!;

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (user.role !== "projectManager" && user.role !== "admin") {
        return res.status(403).json({ message: "Only project managers or admins can access this endpoint" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Ensure PM has access to this specific project
       if (user.role === "projectManager") {
          if (!(await checkProjectAccess(req, res, projectId))) {
             return; // Response handled by checkProjectAccess
          }
       }

      const availableClients = await storage.getClientsNotInProject(projectId);
      // Sanitize client data before sending
      const sanitizedClients = availableClients.map(client => {
          const { password, magicLinkToken, magicLinkExpiry, ...clientData } = client;
          return clientData;
      });

      res.json(sanitizedClients);
    } catch (error) {
      console.error("Error fetching available clients:", error);
      res.status(500).json({ message: "Failed to fetch available clients" });
    }
  });

  // Get client-project assignments - admin only
  app.get("/api/admin/client-projects/:clientId", isAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }

      const client = await storage.getUser(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (client.role !== "client") {
        return res.status(400).json({ message: "User is not a client" });
      }

      const projects = await storage.getClientProjects(clientId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching client projects:", error);
      res.status(500).json({ message: "Failed to fetch client projects" });
    }
  });

  // Assign project manager to project
  app.post("/api/admin/projects/:projectId/project-manager", isAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const { projectManagerId } = req.body;
      if (!projectManagerId || isNaN(parseInt(projectManagerId))) {
        return res.status(400).json({ message: "Valid project manager ID is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const projectManager = await storage.getUser(parseInt(projectManagerId));
      if (!projectManager) {
        return res.status(404).json({ message: "Project manager not found" });
      }

      if (projectManager.role !== "projectManager" && projectManager.role !== "admin") {
        return res.status(400).json({ message: "User is not a project manager or admin" });
      }

      const updatedProject = await storage.updateProject(projectId, {
        // ...project, // Don't spread here, updateProject should handle partial updates
        projectManagerId: parseInt(projectManagerId)
      });

      if (!updatedProject) {
        // updateProject returns the updated project or null if not found
        return res.status(404).json({ message: "Project not found or failed to update" });
      }

      res.status(200).json({
        message: "Project manager assigned successfully",
        project: updatedProject
      });
    } catch (error) {
      console.error("Error assigning project manager:", error);
      res.status(500).json({ message: "Failed to assign project manager" });
    }
  });

  // --- ADDED: Mount the new routers to their respective endpoints ---
  // Each router is mounted to a path with a projectId parameter
  app.use("/api/projects/:projectId/tasks", isAuthenticated, taskRouter);
  app.use("/api/projects/:projectId/daily-logs", isAuthenticated, dailyLogRouter);
  app.use("/api/projects/:projectId/punch-list", isAuthenticated, punchListRouter);
  // --- END ADDED ---

  const httpServer = createServer(app);
  return httpServer;
}