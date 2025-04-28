import {
  users,
  projects,
  clientProjects,
  documents,
  invoices,
  payments,
  messages,
  progressUpdates,
  updateMedia,
  milestones,
  selections,
  // --- ADDED: Import new schema tables ---
  tasks,
  taskDependencies,
  dailyLogs,
  dailyLogPhotos,
  punchListItems,
} from "@shared/schema";
import { db } from "@server/db"; // Updated import
import { eq, and, desc, gte, lt, or, ilike, inArray } from "drizzle-orm"; // Added inArray
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@server/db"; // Updated import
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
  Selection, InsertSelection,
  // --- ADDED: Import new schema types ---
  Task, InsertTask, TaskWithAssignee, // Add combined types if needed
  TaskDependency, InsertTaskDependency,
  DailyLog, InsertDailyLog, DailyLogWithPhotos,
  DailyLogPhoto, InsertDailyLogPhoto,
  PunchListItem, InsertPunchListItem, PunchListItemWithAssignee
  // --- END ADDED ---
} from "@shared/schema";

// Fix typescript issues with session store
declare module "express-session" {
  interface SessionData {
    passport: any;
  }
}

const PostgresSessionStore = connectPg(session);

// --- UPDATED: Add new methods to interface ---
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
  getAllProjectManagers(): Promise<User[]>;
  getAllClients(): Promise<User[]>;
  getClientsNotInProject(projectId: number): Promise<User[]>;
  searchClients(query: string): Promise<User[]>;

  // Project methods
  getProject(id: number): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  getClientProjects(clientId: number): Promise<Project[]>;
  getProjectManagerProjects(projectManagerId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;

  // Client-Project relationship methods
  assignClientToProject(clientId: number, projectId: number): Promise<ClientProject>;
  clientHasProjectAccess(clientId: number, projectId: number): Promise<boolean>;
  projectManagerHasProjectAccess(projectManagerId: number, projectId: number): Promise<boolean>;

  // Document methods
  getAllDocuments(filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]>;
  getProjectDocuments(projectId: number, filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]>;
  getDocumentsForMultipleProjects(projectIds: number[], filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]>; // Added based on usage
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

  // --- ADDED: Task methods ---
  getProjectTasks(projectId: number): Promise<Task[]>; // Consider TaskWithAssignee later
  getTask(taskId: number): Promise<Task | undefined>; // Consider TaskWithAssignee later
  createTask(taskData: InsertTask): Promise<Task>;
  updateTask(taskId: number, taskData: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(taskId: number): Promise<void>;
  // --- END ADDED ---

  // --- ADDED: Task Dependency methods ---
  getTaskDependencies(taskId: number): Promise<TaskDependency[]>;
  getProjectTaskDependencies(projectId: number, taskIds: number[]): Promise<TaskDependency[]>;
  createTaskDependency(depData: InsertTaskDependency): Promise<TaskDependency>;
  deleteTaskDependency(dependencyId: number): Promise<void>;
  // --- END ADDED ---

  // --- ADDED: Daily Log methods ---
  getProjectDailyLogs(projectId: number): Promise<DailyLog[]>; // Consider DailyLogWithPhotos later
  getDailyLog(logId: number): Promise<DailyLog | undefined>; // Consider DailyLogWithPhotos later
  createDailyLog(logData: InsertDailyLog): Promise<DailyLog>;
  updateDailyLog(logId: number, logData: Partial<InsertDailyLog>): Promise<DailyLog | undefined>;
  deleteDailyLog(logId: number): Promise<void>;
  addDailyLogPhoto(photoData: InsertDailyLogPhoto): Promise<DailyLogPhoto>;
  // Consider deleteDailyLogPhoto if needed
  // --- END ADDED ---

  // --- ADDED: Punch List methods ---
  getProjectPunchListItems(projectId: number): Promise<PunchListItem[]>; // Consider PunchListItemWithAssignee later
  getPunchListItem(itemId: number): Promise<PunchListItem | undefined>; // Consider PunchListItemWithAssignee later
  createPunchListItem(itemData: InsertPunchListItem): Promise<PunchListItem>;
  updatePunchListItem(itemId: number, itemData: Partial<InsertPunchListItem>): Promise<PunchListItem | undefined>;
  deletePunchListItem(itemId: number): Promise<void>;
  // --- END ADDED ---

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
      .set({ ...userData, updatedAt: new Date() }) // Ensure updatedAt is updated
      .where(eq(users.id, id))
      .returning();

    return updatedUser;
  }

  async updateUserMagicLinkToken(id: number, token: string | null, expiry: Date | null): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        magicLinkToken: token,
        magicLinkExpiry: expiry,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();

    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllProjectManagers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "projectManager"));
  }

  async getAllClients(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "client"));
  }

  async getClientsNotInProject(projectId: number): Promise<User[]> {
    const allClients = await this.getAllClients();
    if (allClients.length === 0) return [];

    const clientProjectAssignments = await db
      .select({ clientId: clientProjects.clientId })
      .from(clientProjects)
      .where(eq(clientProjects.projectId, projectId));

    const assignedClientIds = new Set(clientProjectAssignments.map(cp => cp.clientId));
    return allClients.filter(client => !assignedClientIds.has(client.id));
  }

  async deleteUser(id: number): Promise<void> {
    // Consider cascading deletes or setting related fields to null in schema first
    // Example: Set assigned tasks/punch list items to null
    await db.update(tasks).set({ assigneeId: null, updatedAt: new Date() }).where(eq(tasks.assigneeId, id));
    await db.update(punchListItems).set({ assigneeId: null, updatedAt: new Date() }).where(eq(punchListItems.assigneeId, id));

    // Delete client-project associations
    await db.delete(clientProjects).where(eq(clientProjects.clientId, id));

    // Now delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async searchClients(query: string): Promise<User[]> {
    if (!query) {
      return [];
    }
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db.select()
      .from(users)
      .where(
        and(
          eq(users.role, "client"),
          or(
            ilike(users.firstName, searchTerm),
            ilike(users.lastName, searchTerm),
            ilike(users.email, searchTerm)
          )
        )
      )
      .limit(10);
  }

  // Project methods
  async getProject(id: number): Promise<Project | undefined> {
    // Example using db.query for potential relation fetching later
    return await db.query.projects.findFirst({
        where: eq(projects.id, id),
        // with: { projectManager: true } // Example of fetching relation
    });
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getClientProjects(clientId: number): Promise<Project[]> {
    const result = await db
      .select({ project: projects })
      .from(clientProjects)
      .innerJoin(projects, eq(clientProjects.projectId, projects.id))
      .where(eq(clientProjects.clientId, clientId))
      .orderBy(desc(projects.createdAt));

    return result.map(r => r.project);
  }

  async createProject(projectData: InsertProject): Promise<Project> {
    const dataToInsert = {
      ...projectData,
      startDate: projectData.startDate && typeof projectData.startDate === 'string' ? new Date(projectData.startDate) : projectData.startDate,
      estimatedCompletionDate: projectData.estimatedCompletionDate && typeof projectData.estimatedCompletionDate === 'string' ? new Date(projectData.estimatedCompletionDate) : projectData.estimatedCompletionDate,
      actualCompletionDate: projectData.actualCompletionDate && typeof projectData.actualCompletionDate === 'string' ? new Date(projectData.actualCompletionDate) : projectData.actualCompletionDate,
      totalBudget: typeof projectData.totalBudget === 'string' ? parseFloat(projectData.totalBudget) : projectData.totalBudget,
    };
    const [newProject] = await db.insert(projects).values(dataToInsert).returning();
    return newProject;
  }

  async updateProject(id: number, projectData: Partial<InsertProject>): Promise<Project | undefined> {
     const dataToSet = {
      ...projectData,
      startDate: (projectData.startDate && typeof projectData.startDate === 'string') ? new Date(projectData.startDate) : projectData.startDate,
      estimatedCompletionDate: (projectData.estimatedCompletionDate && typeof projectData.estimatedCompletionDate === 'string') ? new Date(projectData.estimatedCompletionDate) : projectData.estimatedCompletionDate,
      actualCompletionDate: (projectData.actualCompletionDate && typeof projectData.actualCompletionDate === 'string') ? new Date(projectData.actualCompletionDate) : projectData.actualCompletionDate,
      totalBudget: (projectData.totalBudget !== undefined && typeof projectData.totalBudget === 'string') ? parseFloat(projectData.totalBudget) : projectData.totalBudget,
      updatedAt: new Date(), // Always update 'updatedAt'
    };

    const [updatedProject] = await db
      .update(projects)
      .set(dataToSet)
      .where(eq(projects.id, id))
      .returning();

    return updatedProject; // Returns undefined if not found
  }

  // Client-Project relationship methods
  async assignClientToProject(clientId: number, projectId: number): Promise<ClientProject> {
    // Avoid duplicates - check if exists first (optional, depends on constraints)
    const existing = await db.query.clientProjects.findFirst({
        where: and(eq(clientProjects.clientId, clientId), eq(clientProjects.projectId, projectId))
    });
    if (existing) return existing;

    const [clientProject] = await db.insert(clientProjects).values({ clientId, projectId }).returning();
    return clientProject;
  }

  async clientHasProjectAccess(clientId: number, projectId: number): Promise<boolean> {
    const result = await db.query.clientProjects.findFirst({
        columns: { id: true }, // Select only necessary column
        where: and(eq(clientProjects.clientId, clientId), eq(clientProjects.projectId, projectId))
    });
    return !!result;
  }

  async getProjectManagerProjects(projectManagerId: number): Promise<Project[]> {
    return await db.query.projects.findMany({
        where: eq(projects.projectManagerId, projectManagerId),
        orderBy: desc(projects.createdAt)
    });
  }

  async projectManagerHasProjectAccess(projectManagerId: number, projectId: number): Promise<boolean> {
    const result = await db.query.projects.findFirst({
        columns: { id: true }, // Select only necessary column
        where: and(eq(projects.id, projectId), eq(projects.projectManagerId, projectManagerId))
    });
    return !!result;
  }

  // Document methods
  // Helper to apply date filters
  private applyDateFilters<T extends { createdAt: Date | string }>(items: T[], filters?: { startDate?: Date; endDate?: Date }): T[] {
    if (!filters || (!filters.startDate && !filters.endDate)) {
      return items;
    }
    return items.filter(item => {
      const itemDate = new Date(item.createdAt);
      if (filters.startDate && itemDate < filters.startDate) return false;
      if (filters.endDate) {
        const endDateEndOfDay = new Date(filters.endDate);
        endDateEndOfDay.setHours(23, 59, 59, 999);
        if (itemDate > endDateEndOfDay) return false;
      }
      return true;
    });
  }

  async getAllDocuments(filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]> {
    const allDocs = await db.select().from(documents).orderBy(desc(documents.createdAt));
    return this.applyDateFilters(allDocs, filters);
  }

  async getProjectDocuments(projectId: number, filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]> {
    const projectDocs = await db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.createdAt));
    return this.applyDateFilters(projectDocs, filters);
  }

  async getDocumentsForMultipleProjects(projectIds: number[], filters?: { startDate?: Date; endDate?: Date }): Promise<Document[]> {
     if (projectIds.length === 0) return [];
     const projectDocs = await db.select().from(documents).where(inArray(documents.projectId, projectIds)).orderBy(desc(documents.createdAt));
     return this.applyDateFilters(projectDocs, filters);
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  // Invoice methods
  async getProjectInvoices(projectId: number): Promise<Invoice[]> {
    return await db.query.invoices.findMany({ where: eq(invoices.projectId, projectId) });
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  // Payment methods
  async getInvoicePayments(invoiceId: number): Promise<Payment[]> {
    return await db.query.payments.findMany({ where: eq(payments.invoiceId, invoiceId) });
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  // Message methods
  async getProjectMessages(projectId: number): Promise<Message[]> {
    // Example using db.query with relations
    return await db.query.messages.findMany({
        where: eq(messages.projectId, projectId),
        with: {
            sender: { columns: { id: true, firstName: true, lastName: true, role: true } }, // Fetch sender info
            // recipient: { columns: { id: true, firstName: true, lastName: true, role: true } } // Fetch recipient if needed
        },
        orderBy: desc(messages.createdAt)
    });
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  // Progress update methods
  async getProjectUpdates(projectId: number): Promise<ProgressUpdate[]> {
    // Example using db.query with relations
    return await db.query.progressUpdates.findMany({
        where: eq(progressUpdates.projectId, projectId),
        with: {
            creator: { columns: { id: true, firstName: true, lastName: true, role: true } },
            media: true // Fetch associated media
        },
        orderBy: desc(progressUpdates.createdAt)
    });
  }

  async createProgressUpdate(update: InsertProgressUpdate): Promise<ProgressUpdate> {
    const [newUpdate] = await db.insert(progressUpdates).values(update).returning();
    return newUpdate;
  }

  // Update media methods
  async getUpdateMedia(updateId: number): Promise<UpdateMedia[]> {
    return await db.query.updateMedia.findMany({ where: eq(updateMedia.updateId, updateId) });
  }

  async createUpdateMedia(media: InsertUpdateMedia): Promise<UpdateMedia> {
    const [newMedia] = await db.insert(updateMedia).values(media).returning();
    return newMedia;
  }

  // Milestone methods
  async getProjectMilestones(projectId: number): Promise<Milestone[]> {
    return await db.query.milestones.findMany({ where: eq(milestones.projectId, projectId), orderBy: desc(milestones.plannedDate) });
  }

  async createMilestone(milestone: InsertMilestone): Promise<Milestone> {
    const [newMilestone] = await db.insert(milestones).values(milestone).returning();
    return newMilestone;
  }

  // Selection methods
  async getProjectSelections(projectId: number): Promise<Selection[]> {
    return await db.query.selections.findMany({ where: eq(selections.projectId, projectId), orderBy: desc(selections.createdAt) });
  }

  async createSelection(selection: InsertSelection): Promise<Selection> {
    const [newSelection] = await db.insert(selections).values(selection).returning();
    return newSelection;
  }

  async updateSelectionChoice(id: number, selectedOption: string): Promise<Selection | undefined> {
    const [updatedSelection] = await db
      .update(selections)
      .set({
        selectedOption,
        status: "selected",
        updatedAt: new Date() // Ensure updatedAt is updated
      })
      .where(eq(selections.id, id))
      .returning();

    return updatedSelection;
  }

  // --- ADDED: Task Methods ---
  async getProjectTasks(projectId: number): Promise<Task[]> {
      // Use db.query to potentially include relations later easily
      return await db.query.tasks.findMany({
          where: eq(tasks.projectId, projectId),
          orderBy: desc(tasks.createdAt) // Or order by dueDate, etc.
          // with: { assignee: true } // Add this to fetch assignee details
      });
  }

  async getTask(taskId: number): Promise<Task | undefined> {
      return await db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
          // with: { assignee: true } // Fetch related data if needed
      });
  }

  async createTask(taskData: InsertTask): Promise<Task> {
      const [newTask] = await db.insert(tasks).values(taskData).returning();
      return newTask;
  }

  async updateTask(taskId: number, taskData: Partial<InsertTask>): Promise<Task | undefined> {
      const [updatedTask] = await db.update(tasks)
          .set({ ...taskData, updatedAt: new Date() })
          .where(eq(tasks.id, taskId))
          .returning();
      return updatedTask;
  }

  async deleteTask(taskId: number): Promise<void> {
      // Important: Handle dependencies first if required by your logic/constraints
      await db.delete(taskDependencies).where(or(
          eq(taskDependencies.predecessorId, taskId),
          eq(taskDependencies.successorId, taskId)
      ));
      // Then delete the task
      await db.delete(tasks).where(eq(tasks.id, taskId));
  }
  // --- END Task Methods ---


  // --- ADDED: Task Dependency Methods ---
  async getTaskDependencies(taskId: number): Promise<TaskDependency[]> {
      // Get dependencies where the given task is either a predecessor or successor
      return await db.select().from(taskDependencies).where(
          or(
              eq(taskDependencies.predecessorId, taskId),
              eq(taskDependencies.successorId, taskId)
          )
      );
  }

  async getProjectTaskDependencies(projectId: number, taskIds: number[]): Promise<TaskDependency[]> {
      if (!taskIds.length) return [];

      // Get all dependencies where any task from this project is involved
      return await db.select()
          .from(taskDependencies)
          .where(
              or(
                  inArray(taskDependencies.predecessorId, taskIds),
                  inArray(taskDependencies.successorId, taskIds)
              )
          );
  }

  async createTaskDependency(depData: InsertTaskDependency): Promise<TaskDependency> {
      // Optional: Check for circular dependencies before inserting if needed
      const [newDep] = await db.insert(taskDependencies).values(depData).returning();
      return newDep;
  }

  async deleteTaskDependency(dependencyId: number): Promise<void> {
      await db.delete(taskDependencies).where(eq(taskDependencies.id, dependencyId));
  }
  // --- END Task Dependency Methods ---


  // --- ADDED: Daily Log Methods ---
  async getProjectDailyLogs(projectId: number): Promise<DailyLog[]> { // Return basic log first
    return await db.select().from(dailyLogs)
      .where(eq(dailyLogs.projectId, projectId))
      .orderBy(desc(dailyLogs.logDate));
  }

  // Example of fetching with photos - we'll use basic query until relations are properly set up
  async getProjectDailyLogsWithPhotos(projectId: number): Promise<DailyLogWithPhotos[]> {
    const logs = await db.select().from(dailyLogs)
      .where(eq(dailyLogs.projectId, projectId))
      .orderBy(desc(dailyLogs.logDate));

    // This is a simplified version - in a real implementation we'd fetch photos for each log
    // For now, return the logs cast as DailyLogWithPhotos (empty photos array)
    return logs as unknown as DailyLogWithPhotos[];
  }

  async getDailyLog(logId: number): Promise<DailyLog | undefined> { // Consider with photos
    const [log] = await db.select().from(dailyLogs)
      .where(eq(dailyLogs.id, logId));
    return log;
  }

  async createDailyLog(logData: InsertDailyLog): Promise<DailyLog> {
    const [newLog] = await db.insert(dailyLogs).values(logData).returning();
    return newLog;
  }

  async updateDailyLog(logId: number, logData: Partial<InsertDailyLog>): Promise<DailyLog | undefined> {
      // Cannot update 'createdAt' or 'createdById', filter them out if present
      const { createdAt, createdById, ...updateData } = logData;
      const [updatedLog] = await db.update(dailyLogs)
          .set(updateData) // No automatic updatedAt here, add if needed in schema/logic
          .where(eq(dailyLogs.id, logId))
          .returning();
      return updatedLog;
  }

  async deleteDailyLog(logId: number): Promise<void> {
    // Schema uses onDelete: 'cascade' for photos, so deleting log deletes photos
    await db.delete(dailyLogs).where(eq(dailyLogs.id, logId));
  }

  async addDailyLogPhoto(photoData: InsertDailyLogPhoto): Promise<DailyLogPhoto> {
    const [newPhoto] = await db.insert(dailyLogPhotos).values(photoData).returning();
    return newPhoto;
  }
  // --- END Daily Log Methods ---


  // --- ADDED: Punch List Methods ---
  async getProjectPunchListItems(projectId: number): Promise<PunchListItem[]> {
    return await db.select().from(punchListItems)
      .where(eq(punchListItems.projectId, projectId))
      .orderBy(desc(punchListItems.createdAt));
  }

  async getPunchListItem(itemId: number): Promise<PunchListItem | undefined> {
    const [item] = await db.select().from(punchListItems)
      .where(eq(punchListItems.id, itemId));
    return item;
  }

  async createPunchListItem(itemData: InsertPunchListItem): Promise<PunchListItem> {
     const [newItem] = await db.insert(punchListItems).values(itemData).returning();
     return newItem;
  }

  async updatePunchListItem(itemId: number, itemData: Partial<InsertPunchListItem>): Promise<PunchListItem | undefined> {
      const dataToSet = {
          ...itemData,
          updatedAt: new Date(), // Always update timestamp
          resolvedAt: itemData.status === 'resolved' || itemData.status === 'verified' ? new Date() : undefined // Set resolvedAt if status indicates resolution
      };

      const [updatedItem] = await db.update(punchListItems)
          .set(dataToSet)
          .where(eq(punchListItems.id, itemId))
          .returning();
      return updatedItem;
  }

  async deletePunchListItem(itemId: number): Promise<void> {
      await db.delete(punchListItems).where(eq(punchListItems.id, itemId));
  }
  // --- END Punch List Methods ---

} // End of DatabaseStorage class

export const storage = new DatabaseStorage();