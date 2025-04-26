import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from 'multer'; // <-- Import multer
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
  User // Added User type import
} from "@shared/schema";
import { z } from "zod";
import { isEmailServiceConfigured, sendMagicLinkEmail } from "./email";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { ilike, or } from "drizzle-orm";

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

  return true;
}

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
      // Check permissions based on role
      if (user.role === "admin") {
        // Admins can access any project
      } else if (user.role === "projectManager") {
        // Project managers can only access projects they're assigned to
        const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
      } else if (user.role === "client") {
        // Clients can only access projects they're assigned to
        const hasAccess = await storage.clientHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
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
      const { clientIds, ...projectData } = insertProjectSchema.parse(req.body);
      console.log("Validated edit project data:", projectData);

      const updatedProject = await storage.updateProject(projectId, projectData);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

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

      if (user.role === "projectManager") {
        const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
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

  // --- MODIFIED Document Upload Route ---
  // Note: Assuming 'documentFile' is the field name used in the frontend form for the file input
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
        if (user.role === "client") {
          return res.status(403).json({ message: "Clients cannot upload documents" });
        } else if (user.role === "projectManager") {
          const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
          if (!hasAccess) {
            return res.status(403).json({ message: "You don't have access to this project" });
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
  // --- END MODIFIED Document Upload Route ---

  // Get all documents (for document center)
  app.get("/api/documents", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      let documents = [];

      // Parse date filters from query params if provided
      const filters: { startDate?: Date; endDate?: Date } = {};

      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }

      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
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
        const projectDocuments = await Promise.all(
          pmProjects.map(project => storage.getProjectDocuments(project.id, filters))
        );

        // Flatten the array of document arrays
        documents = projectDocuments.flat();
      } else {
        // Clients can only see documents from projects they have access to
        const clientProjects = await storage.getClientProjects(user.id);

        if (clientProjects.length === 0) {
          return res.json([]);
        }

        // Fetch documents for each project the client has access to
        const projectDocuments = await Promise.all(
          clientProjects.map(project => storage.getProjectDocuments(project.id, filters))
        );

        // Flatten the array of document arrays
        documents = projectDocuments.flat();
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

      if (user.role === "client") {
        return res.status(403).json({ message: "Clients cannot create progress updates" });
      } else if (user.role === "projectManager") {
        const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
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

      if (user.role === "client") {
        return res.status(403).json({ message: "Clients cannot create milestones" });
      } else if (user.role === "projectManager") {
        const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
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

      if (user.role === "client") {
        return res.status(403).json({ message: "Clients cannot create selections" });
      } else if (user.role === "projectManager") {
        const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
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
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get all project managers (admin only)
  app.get("/api/project-managers", isAdmin, async (req, res) => {
    try {
      const projectManagers = await storage.getAllProjectManagers();
      res.json(projectManagers);
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
        return res.status(403).json({ message: "Only project managers can access this endpoint" });
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

      if (user.role === "projectManager") {
        const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
      }

      const availableClients = await storage.getClientsNotInProject(projectId);

      res.json(availableClients);
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
        return res.status(400).json({ message: "User is not a project manager" });
      }

      const updatedProject = await storage.updateProject(projectId, {
        ...project,
        projectManagerId: parseInt(projectManagerId)
      });

      if (!updatedProject) {
        return res.status(500).json({ message: "Failed to assign project manager" });
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

  const httpServer = createServer(app);
  return httpServer;
}