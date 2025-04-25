import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertProjectSchema, 
  insertDocumentSchema, 
  insertInvoiceSchema, 
  insertMessageSchema, 
  insertProgressUpdateSchema,
  insertMilestoneSchema,
  insertSelectionSchema
} from "@shared/schema";
import { z } from "zod";
import { isEmailServiceConfigured } from "./email";

// Helper function to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Helper function to check if user is an admin
function isAdmin(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated() && req.user && req.user.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Admin access required" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Development-only route to create an admin user
  if (process.env.NODE_ENV === 'development') {
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
      
      if (user.role === "admin" || user.role === "projectManager") {
        // Admins and project managers can see all projects
        projects = await storage.getAllProjects();
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

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
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
      const projectData = insertProjectSchema.parse(req.body);
      const newProject = await storage.createProject(projectData);
      res.status(201).json(newProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
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

      const projectData = insertProjectSchema.parse(req.body);
      const updatedProject = await storage.updateProject(projectId, projectData);
      
      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Client-project association routes
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

  // Document routes
  app.get("/api/projects/:projectId/documents", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
      }

      const documents = await storage.getProjectDocuments(projectId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/projects/:projectId/documents", isAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const documentData = insertDocumentSchema.parse({
        ...req.body,
        projectId,
        uploadedById: req.user!.id
      });
      
      const newDocument = await storage.createDocument(documentData);
      res.status(201).json(newDocument);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid document data", errors: error.errors });
      }
      console.error("Error creating document:", error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // Financial routes
  app.get("/api/projects/:projectId/invoices", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
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

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
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

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
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

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
      }

      const updates = await storage.getProjectUpdates(projectId);
      res.json(updates);
    } catch (error) {
      console.error("Error fetching updates:", error);
      res.status(500).json({ message: "Failed to fetch updates" });
    }
  });

  app.post("/api/projects/:projectId/updates", isAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const updateData = insertProgressUpdateSchema.parse({
        ...req.body,
        projectId,
        createdById: req.user!.id
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

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
      }

      const milestones = await storage.getProjectMilestones(projectId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.post("/api/projects/:projectId/milestones", isAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
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

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
      }

      const selections = await storage.getProjectSelections(projectId);
      res.json(selections);
    } catch (error) {
      console.error("Error fetching selections:", error);
      res.status(500).json({ message: "Failed to fetch selections" });
    }
  });

  app.post("/api/projects/:projectId/selections", isAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
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

      // Check if client has access to this project
      if (req.user!.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(req.user!.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You don't have access to this project" });
        }
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
      
      if (user.role === "admin" || user.role === "projectManager") {
        // Admins and project managers can see all documents
        documents = await storage.getAllDocuments(filters);
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
  
  // Get client-project assignments - admin only
  // Check email service configuration status - admin only
  app.get("/api/admin/email-config", isAdmin, (req, res) => {
    res.json({ configured: isEmailServiceConfigured() });
  });

  app.get("/api/admin/client-projects/:clientId", isAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }
      
      // Check if client exists
      const client = await storage.getUser(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Only get projects for users with client role
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

  const httpServer = createServer(app);
  return httpServer;
}
