import { users, projects, clientProjects, documents, invoices, payments, messages, progressUpdates, updateMedia, milestones, selections } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lt } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import type {
  User, InsertUser,
  Project, InsertProject,
  ClientProject, InsertClientProject,
  Document, InsertDocument,
  Invoice, InsertInvoice,
  Payment, InsertPayment,
  Message, InsertMessage,
  ProgressUpdate, InsertProgressUpdate,
  UpdateMedia, InsertUpdateMedia,
  Milestone, InsertMilestone,
  Selection, InsertSelection
} from "@shared/schema";

// Fix typescript issues with session store
declare module "express-session" {
  interface SessionData {
    passport: any;
  }
}

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByMagicLinkToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User>;
  updateUserMagicLinkToken(id: number, token: string | null, expiry: Date | null): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Project methods
  getProject(id: number): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  getClientProjects(clientId: number): Promise<Project[]>;
  getProjectManagerProjects(projectManagerId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: InsertProject): Promise<Project | undefined>;
  
  // Client-Project relationship methods
  assignClientToProject(clientId: number, projectId: number): Promise<ClientProject>;
  clientHasProjectAccess(clientId: number, projectId: number): Promise<boolean>;
  projectManagerHasProjectAccess(projectManagerId: number, projectId: number): Promise<boolean>;
  
  // Document methods
  getAllDocuments(filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]>;
  getProjectDocuments(projectId: number, filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  
  // Invoice methods
  getProjectInvoices(projectId: number): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  
  // Payment methods
  getInvoicePayments(invoiceId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  
  // Message methods
  getProjectMessages(projectId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Progress update methods
  getProjectUpdates(projectId: number): Promise<ProgressUpdate[]>;
  createProgressUpdate(update: InsertProgressUpdate): Promise<ProgressUpdate>;
  
  // Update media methods
  getUpdateMedia(updateId: number): Promise<UpdateMedia[]>;
  createUpdateMedia(media: InsertUpdateMedia): Promise<UpdateMedia>;
  
  // Milestone methods
  getProjectMilestones(projectId: number): Promise<Milestone[]>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  
  // Selection methods
  getProjectSelections(projectId: number): Promise<Selection[]>;
  createSelection(selection: InsertSelection): Promise<Selection>;
  updateSelectionChoice(id: number, selectedOption: string): Promise<Selection | undefined>;
  
  // Session store
  sessionStore: any; // Using any type for sessionStore to avoid typing issues
}

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Using any type for sessionStore

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session'
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByMagicLinkToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.magicLinkToken, token));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }
  
  async updateUserMagicLinkToken(id: number, token: string | null, expiry: Date | null): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        magicLinkToken: token,
        magicLinkExpiry: expiry
      })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  // Get all project managers
  async getAllProjectManagers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "projectManager"));
  }
  
  // Get all clients
  async getAllClients(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "client"));
  }
  
  // Get clients not assigned to a specific project
  async getClientsNotInProject(projectId: number): Promise<User[]> {
    // First get all clients
    const allClients = await this.getAllClients();
    
    // Get all client IDs already assigned to this project
    const clientProjectAssignments = await db
      .select({ clientId: clientProjects.clientId })
      .from(clientProjects)
      .where(eq(clientProjects.projectId, projectId));
    
    const assignedClientIds = new Set(clientProjectAssignments.map(cp => cp.clientId));
    
    // Filter out clients that are already assigned to this project
    return allClients.filter(client => !assignedClientIds.has(client.id));
  }
  
  async deleteUser(id: number): Promise<void> {
    // Delete all client-project associations first
    await db
      .delete(clientProjects)
      .where(eq(clientProjects.clientId, id));
      
    // Now delete the user
    await db
      .delete(users)
      .where(eq(users.id, id));
  }

  // Project methods
  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getClientProjects(clientId: number): Promise<Project[]> {
    const result = await db
      .select({
        project: projects
      })
      .from(clientProjects)
      .innerJoin(projects, eq(clientProjects.projectId, projects.id))
      .where(eq(clientProjects.clientId, clientId));
    
    return result.map(r => r.project);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: InsertProject): Promise<Project | undefined> {
    const [updatedProject] = await db
      .update(projects)
      .set(project)
      .where(eq(projects.id, id))
      .returning();
    
    return updatedProject;
  }

  // Client-Project relationship methods
  async assignClientToProject(clientId: number, projectId: number): Promise<ClientProject> {
    const [clientProject] = await db
      .insert(clientProjects)
      .values({ clientId, projectId })
      .returning();
    
    return clientProject;
  }

  async clientHasProjectAccess(clientId: number, projectId: number): Promise<boolean> {
    const [result] = await db
      .select()
      .from(clientProjects)
      .where(
        and(
          eq(clientProjects.clientId, clientId),
          eq(clientProjects.projectId, projectId)
        )
      );
    
    return !!result;
  }
  
  async getProjectManagerProjects(projectManagerId: number): Promise<Project[]> {
    // Find all projects where the user is assigned as project manager
    return await db
      .select()
      .from(projects)
      .where(eq(projects.projectManagerId, projectManagerId));
  }
  
  async projectManagerHasProjectAccess(projectManagerId: number, projectId: number): Promise<boolean> {
    // Check if the user is assigned as a project manager for this project
    const [project] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.projectManagerId, projectManagerId)
        )
      );
      
    return !!project;
  }

  // Document methods
  async getAllDocuments(filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]> {
    // Apply filters in JavaScript to avoid complex SQL queries
    const allDocs = await db.select().from(documents).orderBy(desc(documents.createdAt));
    
    if (!filters || (!filters.startDate && !filters.endDate)) {
      return allDocs;
    }
    
    // Filter documents by date range in JavaScript
    return allDocs.filter(doc => {
      const docDate = new Date(doc.createdAt);
      
      // Filter by start date if provided
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (docDate < startDate) {
          return false;
        }
      }
      
      // Filter by end date if provided
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        // Set time to end of day to include the end date
        endDate.setHours(23, 59, 59, 999);
        if (docDate > endDate) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  async getProjectDocuments(
    projectId: number, 
    filters?: { startDate?: Date; endDate?: Date }
  ): Promise<Document[]> {
    // First get all documents for the project
    const projectDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documents.createdAt));
    
    if (!filters || (!filters.startDate && !filters.endDate)) {
      return projectDocs;
    }
    
    // Filter documents by date range in JavaScript
    return projectDocs.filter(doc => {
      const docDate = new Date(doc.createdAt);
      
      // Filter by start date if provided
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (docDate < startDate) {
          return false;
        }
      }
      
      // Filter by end date if provided
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        // Set time to end of day to include the end date
        endDate.setHours(23, 59, 59, 999);
        if (docDate > endDate) {
          return false;
        }
      }
      
      return true;
    });
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    
    return newDocument;
  }

  // Invoice methods
  async getProjectInvoices(projectId: number): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.projectId, projectId));
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db
      .insert(invoices)
      .values(invoice)
      .returning();
    
    return newInvoice;
  }

  // Payment methods
  async getInvoicePayments(invoiceId: number): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db
      .insert(payments)
      .values(payment)
      .returning();
    
    return newPayment;
  }

  // Message methods
  async getProjectMessages(projectId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.projectId, projectId));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    
    return newMessage;
  }

  // Progress update methods
  async getProjectUpdates(projectId: number): Promise<ProgressUpdate[]> {
    return await db
      .select()
      .from(progressUpdates)
      .where(eq(progressUpdates.projectId, projectId));
  }

  async createProgressUpdate(update: InsertProgressUpdate): Promise<ProgressUpdate> {
    const [newUpdate] = await db
      .insert(progressUpdates)
      .values(update)
      .returning();
    
    return newUpdate;
  }

  // Update media methods
  async getUpdateMedia(updateId: number): Promise<UpdateMedia[]> {
    return await db
      .select()
      .from(updateMedia)
      .where(eq(updateMedia.updateId, updateId));
  }

  async createUpdateMedia(media: InsertUpdateMedia): Promise<UpdateMedia> {
    const [newMedia] = await db
      .insert(updateMedia)
      .values(media)
      .returning();
    
    return newMedia;
  }

  // Milestone methods
  async getProjectMilestones(projectId: number): Promise<Milestone[]> {
    return await db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, projectId));
  }

  async createMilestone(milestone: InsertMilestone): Promise<Milestone> {
    const [newMilestone] = await db
      .insert(milestones)
      .values(milestone)
      .returning();
    
    return newMilestone;
  }

  // Selection methods
  async getProjectSelections(projectId: number): Promise<Selection[]> {
    return await db
      .select()
      .from(selections)
      .where(eq(selections.projectId, projectId));
  }

  async createSelection(selection: InsertSelection): Promise<Selection> {
    const [newSelection] = await db
      .insert(selections)
      .values(selection)
      .returning();
    
    return newSelection;
  }

  async updateSelectionChoice(id: number, selectedOption: string): Promise<Selection | undefined> {
    const [updatedSelection] = await db
      .update(selections)
      .set({ 
        selectedOption, 
        status: "selected"
      })
      .where(eq(selections.id, id))
      .returning();
    
    return updatedSelection;
  }
}

export const storage = new DatabaseStorage();
